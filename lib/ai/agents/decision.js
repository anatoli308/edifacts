/**
 * Decision Agent (Continuation Decider)
 * =====================================
 * Status: ✅ Implemented (v1.x Late)
 * Human Analog: Anterior Cingulate Cortex (Conflict monitoring, decision to continue/stop)
 *
 * Purpose: After each successfully completed task, decide whether the agent
 * pipeline should continue, stop early, or modify the remaining plan based on
 * what has already been discovered.
 *
 * Responsibilities:
 * - Inspect goal, completed task summaries, and remaining tasks
 * - Decide one of: continue | stop | modify
 * - For `modify`: return ids of tasks to skip and/or new tasks to inject
 * - Stay cheap and fast (low temperature, small token budget)
 *
 * Inputs (invoke params):
 * - goal:              string  — original user goal
 * - completedTasks:    Set<string>  — ids of tasks already completed
 * - subtaskResults:    object  — map taskId → { assistantMessage, toolCalls, ... }
 * - remainingTasks:    Array   — task objects still queued
 * - executionContext:  object  — must include `provider`
 *
 * Output:
 * {
 *   action: 'continue' | 'stop' | 'modify',
 *   reason: string,
 *   removeIds: string[],   // ids of remaining tasks to drop (only for 'modify')
 *   addTasks: Array        // new tasks to append (only for 'modify')
 * }
 *
 * Failure mode: Any LLM/parse error degrades to `{ action: 'continue' }` so the
 * pipeline keeps running with the original plan. Continuation is advisory, not
 * load-bearing for correctness.
 *
 * Provider-Agnostic: Works with any LLM provider.
 */
import { EventEmitter } from 'events';
import { getPrompt } from '../prompts/index.js';

const DECISION_CONFIG = {
    temperature: 0.1,
    maxTokens: 400,
    timeoutMs: 10000,
    maxCompletedSummaryChars: 400
};

const VALID_ACTIONS = ['continue', 'stop', 'modify'];

export class Decision extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            ...DECISION_CONFIG,
            ...config
        };
    }

    reset() {
        // Stateless — no per-execution state to clear yet
        console.log('[Decision] State reset');
    }

    /**
     * Decide whether to continue, stop, or modify the remaining plan.
     *
     * @param {object} params
     * @param {string} params.goal
     * @param {Set<string>} params.completedTasks
     * @param {object} params.subtaskResults
     * @param {Array} params.remainingTasks
     * @param {object} params.executionContext
     * @returns {Promise<{action: string, reason: string, removeIds: string[], addTasks: Array}>}
     */
    async invoke({ goal, completedTasks, subtaskResults, remainingTasks, executionContext }) {
        const provider = executionContext?.provider;
        if (!provider) {
            return this._fallback('no provider available');
        }

        this.emit('agent_decision:started', {
            completedCount: completedTasks?.size || 0,
            remainingCount: remainingTasks?.length || 0,
            timestamp: Date.now()
        });

        const systemPrompt = getPrompt('continuation');
        const userPrompt = this._buildUserPrompt(goal, completedTasks, subtaskResults, remainingTasks);

        let raw;
        try {
            const response = await Promise.race([
                provider.complete({
                    messages: [{ role: 'user', content: userPrompt }],
                    systemPrompt,
                    options: {
                        temperature: this.config.temperature,
                        maxTokens: this.config.maxTokens
                    }
                }),
                new Promise((_, reject) => setTimeout(
                    () => reject(new Error(`Decision timeout ${this.config.timeoutMs}ms`)),
                    this.config.timeoutMs
                ))
            ]);
            raw = typeof response === 'string' ? response : (response?.content || '');
        } catch (err) {
            console.warn(`[Decision] LLM call failed: ${err.message}`);
            return this._fallback(`llm error: ${err.message}`);
        }

        const parsed = this._parseResponse(raw);
        if (!parsed) {
            return this._fallback('unparsable response');
        }

        this.emit('agent_decision:completed', {
            action: parsed.action,
            reason: parsed.reason,
            removedIds: parsed.removeIds,
            addedTasks: parsed.addTasks.map(t => ({ id: t.id, name: t.name })),
            timestamp: Date.now()
        });

        return parsed;
    }

    /**
     * Build user prompt with goal, completed summaries, and remaining tasks.
     * @private
     */
    _buildUserPrompt(goal, completedTasks, subtaskResults, remainingTasks) {
        const completedSummary = Array.from(completedTasks || []).map(id => {
            const r = subtaskResults?.[id] || {};
            const summary = (r.assistantMessage || '').slice(0, this.config.maxCompletedSummaryChars);
            const toolNames = (r.toolCalls || []).map(tc => tc.tool || tc.name).filter(Boolean);
            return { id, tools: toolNames, summary };
        });

        const remainingSummary = (remainingTasks || []).map(t => ({
            id: t.id,
            name: t.name,
            description: t.description || '',
            tools: t.tools || []
        }));

        return [
            `Goal: ${goal}`,
            ``,
            `Completed tasks (${completedSummary.length}):`,
            JSON.stringify(completedSummary, null, 2),
            ``,
            `Remaining tasks (${remainingSummary.length}):`,
            JSON.stringify(remainingSummary, null, 2),
            ``,
            `Decide: continue, stop, or modify? Respond with JSON only.`
        ].join('\n');
    }

    /**
     * Robust JSON extraction (markdown fence or first/last brace).
     * @private
     */
    _parseResponse(text) {
        if (!text || typeof text !== 'string') return null;

        let jsonStr = null;
        const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) {
            jsonStr = fenceMatch[1].trim();
        } else {
            const open = text.indexOf('{');
            const close = text.lastIndexOf('}');
            if (open !== -1 && close > open) {
                jsonStr = text.slice(open, close + 1);
            }
        }
        if (!jsonStr) return null;

        try {
            const obj = JSON.parse(jsonStr);
            if (!VALID_ACTIONS.includes(obj.action)) return null;
            return {
                action: obj.action,
                reason: typeof obj.reason === 'string' ? obj.reason : '',
                removeIds: Array.isArray(obj.removeIds) ? obj.removeIds : [],
                addTasks: Array.isArray(obj.addTasks) ? obj.addTasks : []
            };
        } catch {
            return null;
        }
    }

    /**
     * Safe default that lets the pipeline keep running on any failure.
     * @private
     */
    _fallback(reason) {
        return {
            action: 'continue',
            reason,
            removeIds: [],
            addTasks: []
        };
    }
}

export default Decision;
