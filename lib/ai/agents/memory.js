/**
 * Memory Agent (Context Management & RAG-backed Long-Term Memory)
 * ================================================================
 * Status: ✅ v1.x Late
 * Human Analog: Hippocampus (short-term encoding + long-term consolidation)
 *
 * Layers:
 *   1. Working memory       — in-process, per-instance (task, recent observations)
 *   2. Episodic memory      — owned by the Chat repository (Prisma, append-only)
 *   3. Semantic memory      — knowledge_chunks via RAG (this agent writes here)
 *
 * ⚠️ Scope boundary:
 *   - Memory Agent stores user-specific facts and preferences ("user prefers German",
 *     "user works with INVOIC messages from supplier X"). NEVER seeds general
 *     EDIFACT knowledge — that belongs to scripts/seedRag.js.
 *
 * RAG storage convention:
 *   source     = 'USER_MEMORY'
 *   category   = 'FACT' | 'PREFERENCE' | 'CONTEXT'
 *   code       = stable per-user content hash (idempotent upsert)
 *   metadata   = { userId, sessionId, type, recordedAt }
 *
 * Pattern:
 *   - EventEmitter (`agent_memory:started`, `:recalled`, `:remembered`, `:completed`)
 *   - Dependency-injectable config (override CONFIG, embedder, retriever in tests)
 *   - No setTimeout / setInterval (forbidden by repo rule)
 *   - reset() clears working memory only; persisted memory survives
 */

import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';

import { hybridSearch, upsertChunks, deleteByUserId } from '../rag/index.js';

const MEMORY_CONFIG = {
    maxRecentObservations: 20,
    defaultRecallTopK: 5,
    summaryMaxTokens: 2000,
    tokenCharsPerToken: 4, // crude estimate, replace with real tokenizer if needed
};

const VALID_CATEGORIES = new Set(['FACT', 'PREFERENCE', 'CONTEXT']);
const SOURCE = 'USER_MEMORY';

export class Memory extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = { ...MEMORY_CONFIG, ...config };

        this.workingMemory = {
            currentTask: null,
            recentObservations: [], // ring buffer trimmed at maxRecentObservations
        };
    }

    /**
     * Clear working memory between user turns. Persisted memory in RAG is untouched.
     */
    reset() {
        this.workingMemory = { currentTask: null, recentObservations: [] };
        this.emit('agent_memory:reset', { timestamp: Date.now() });
    }

    /**
     * Push an observation into working memory. Cheap, synchronous, no network.
     */
    observe(obs) {
        if (!obs || typeof obs !== 'object') return;
        const entry = { ...obs, timestamp: Date.now() };
        this.workingMemory.recentObservations.push(entry);
        const overflow =
            this.workingMemory.recentObservations.length - this.config.maxRecentObservations;
        if (overflow > 0) {
            this.workingMemory.recentObservations.splice(0, overflow);
        }
    }

    /**
     * Retrieve user-scoped long-term memory plus current working observations.
     *
     * @param {object} params
     * @param {string} params.userId               REQUIRED — memory is per-user
     * @param {string} [params.sessionId]          optional further scope
     * @param {string} [params.query]              natural-language retrieval query
     * @param {string} [params.category]           FACT | PREFERENCE | CONTEXT
     * @param {number} [params.topK=5]
     */
    async recall({ userId, sessionId, query, category, topK } = {}) {
        const startedAt = Date.now();
        this.emit('agent_memory:started', { op: 'recall', userId, sessionId });

        if (!userId) {
            return _fail('recall: userId is required', startedAt);
        }

        if (category && !VALID_CATEGORIES.has(category)) {
            return _fail(`recall: invalid category "${category}"`, startedAt);
        }

        try {
            const metadataFilter = sessionId ? { userId, sessionId } : { userId };

            let mode = 'empty';
            let results = [];

            if (query && query.trim().length > 0) {
                const out = await hybridSearch({
                    query,
                    source: SOURCE,
                    category,
                    metadataFilter,
                    topK: topK ?? this.config.defaultRecallTopK,
                });
                mode = out.mode;
                results = out.results;
            }

            const payload = {
                success: true,
                mode,
                userId,
                sessionId: sessionId ?? null,
                workingMemory: {
                    currentTask: this.workingMemory.currentTask,
                    recentObservationCount: this.workingMemory.recentObservations.length,
                    recentObservations: [...this.workingMemory.recentObservations],
                },
                longTerm: results.map(_shapeMemory),
                durationMs: Date.now() - startedAt,
            };

            this.emit('agent_memory:recalled', {
                userId,
                sessionId,
                count: results.length,
                mode,
            });
            this.emit('agent_memory:completed', { op: 'recall', durationMs: payload.durationMs });

            return payload;
        } catch (err) {
            return _fail(`recall failed: ${err?.message || String(err)}`, startedAt);
        }
    }

    /**
     * Persist a fact, preference, or context note into long-term memory.
     * Idempotent — same (userId, content) overwrites in place (via stable hash code).
     */
    async remember({ userId, sessionId, title, content, category = 'FACT', metadata = {} } = {}) {
        const startedAt = Date.now();
        this.emit('agent_memory:started', { op: 'remember', userId, sessionId, category });

        if (!userId) return _fail('remember: userId is required', startedAt);
        if (typeof title !== 'string' || !title.trim()) {
            return _fail('remember: title is required', startedAt);
        }
        if (typeof content !== 'string' || !content.trim()) {
            return _fail('remember: content is required', startedAt);
        }
        if (!VALID_CATEGORIES.has(category)) {
            return _fail(`remember: invalid category "${category}"`, startedAt);
        }

        try {
            const code = _stableHash(userId, content);
            const chunk = {
                source: SOURCE,
                category,
                code,
                title: title.slice(0, 200),
                content,
                userId,
                metadata: {
                    ...metadata,
                    userId,
                    sessionId: sessionId ?? null,
                    type: category,
                    recordedAt: new Date().toISOString(),
                },
            };

            const { inserted, skipped } = await upsertChunks([chunk]);

            this.emit('agent_memory:remembered', {
                userId,
                sessionId,
                category,
                code,
                inserted,
                skipped,
            });
            const durationMs = Date.now() - startedAt;
            this.emit('agent_memory:completed', { op: 'remember', durationMs });

            return {
                success: true,
                code,
                category,
                inserted,
                skipped,
                durationMs,
            };
        } catch (err) {
            return _fail(`remember failed: ${err?.message || String(err)}`, startedAt);
        }
    }

    /**
     * GDPR right-to-be-forgotten — purge ALL long-term memory for the given user.
     * Working memory is also cleared.
     */
    async forget({ userId } = {}) {
        const startedAt = Date.now();
        this.emit('agent_memory:started', { op: 'forget', userId });

        if (!userId) return _fail('forget: userId is required', startedAt);

        try {
            const affected = await deleteByUserId(userId);
            this.reset();
            const durationMs = Date.now() - startedAt;
            this.emit('agent_memory:forgotten', { userId, affected, durationMs });
            this.emit('agent_memory:completed', { op: 'forget', durationMs });
            return { success: true, userId, deleted: Number(affected) || 0, durationMs };
        } catch (err) {
            return _fail(`forget failed: ${err?.message || String(err)}`, startedAt);
        }
    }

    /**
     * Build an LLM-friendly context window: keep recent messages whole, summarize
     * older ones into a single header line. Token-aware via char heuristic.
     */
    buildContextSummary({ messages, maxTokens } = {}) {
        const budget = maxTokens ?? this.config.summaryMaxTokens;
        if (!Array.isArray(messages) || messages.length === 0) {
            return { summary: '', recentMessages: [], skippedCount: 0, tokenEstimate: 0 };
        }

        const charsPerToken = this.config.tokenCharsPerToken;
        const charBudget = Math.floor(budget * charsPerToken * 0.8);

        const recent = [];
        let chars = 0;
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            const m = messages[i];
            const c = (m?.content || '').length + 32;
            if (chars + c > charBudget) break;
            recent.unshift(m);
            chars += c;
        }

        const skippedCount = messages.length - recent.length;
        const intents = messages
            .slice(0, skippedCount)
            .map((m) => m?.metadata?.intent)
            .filter(Boolean);

        let summary = '';
        if (skippedCount > 0) {
            const intentTag = intents.length
                ? ` (intents: ${[...new Set(intents)].join(', ')})`
                : '';
            summary = `[${skippedCount} earlier messages omitted${intentTag}]`;
        }

        return {
            summary,
            recentMessages: recent,
            skippedCount,
            tokenEstimate: Math.ceil(chars / charsPerToken),
        };
    }
}

// ---- helpers ---------------------------------------------------------------

const _stableHash = (userId, content) => {
    return createHash('sha1').update(`${userId}::${content}`).digest('hex').slice(0, 24);
};

const _shapeMemory = (row) => ({
    code: row.code,
    category: row.category,
    title: row.title,
    content: row.content,
    similarity: row.similarity,
    recordedAt: row.metadata?.recordedAt ?? null,
});

const _fail = (msg, startedAt) => ({
    success: false,
    error: msg,
    durationMs: Date.now() - startedAt,
});
