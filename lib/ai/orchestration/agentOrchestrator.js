/**
 * Agent Orchestration Service
 * ===========================
 * Koordiniert Planner + Scheduler execution
 * 
 * Verantwortlichkeiten:
 * - Planner Agent aufrufen (Task-Decomposition)
 * - Scheduler mit Executor + Critic orchestrieren
 * - Ergebnisse aggregieren
 */
import { EventEmitter } from 'events';
import { aggregateUsage } from '../../utils/usageCalculator.js';

export class AgentOrchestrator extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            maxReplans: 2,
            ...config
        };

        // Required agents from SessionContext
        this.planner = config.planner;
        this.scheduler = config.scheduler;
        this.executor = config.executor;
        this.critic = config.critic;

        if (!this.planner || !this.scheduler || !this.executor || !this.critic) {
            throw new Error('All agents (planner, scheduler, executor, critic) are required for AgentOrchestrator');
        }
    }

    /**
     * Führe kompletten Agent-Pipeline aus (Planner → Scheduler → Aggregation)
     * @param {string} userMessage - User input
     * @param {Array} conversationMessages - Chat history
     * @param {object} executionContext - Execution context (domain, provider, session, user, etc)
     * @returns {Promise<object>} Aggregierte Ergebnisse
     */
    async execute(userMessage, conversationMessages, executionContext) {
        // Validate provider in context
        if (!executionContext.provider) {
            throw new Error('Provider required in executionContext');
        }

        // Step 1: Plan - Benutzer-Goal in Task-Tree zerlegen
        let planResult = await this._executePlanner(
            userMessage,
            conversationMessages,
            executionContext
        );

        // Replanning loop
        let replanAttempts = 0;
        let schedulerResult;

        while (replanAttempts <= this.config.maxReplans) {
            // Step 2: Schedule & Execute
            schedulerResult = await this._executeScheduler(
                planResult,
                conversationMessages,
                executionContext
            );

            // Check if replanning is needed
            if (schedulerResult.needsReplanning && replanAttempts < this.config.maxReplans) {
                replanAttempts++;
                console.log(`[AgentOrchestrator] Replanning attempt ${replanAttempts}/${this.config.maxReplans}: ${schedulerResult.replanFeedback?.reason}`);

                this.emit('agent_orchestrator:replanning', {
                    attempt: replanAttempts,
                    maxAttempts: this.config.maxReplans,
                    reason: schedulerResult.replanFeedback?.reason,
                    timestamp: Date.now()
                });

                // Reset scheduler state for re-execution
                this.scheduler.reset();

                // Replan with failure feedback
                planResult = await this.planner.replan({
                    originalPlan: planResult,
                    replanFeedback: schedulerResult.replanFeedback,
                    executionContext,
                    messages: conversationMessages
                });

                continue; // Retry with new plan
            }

            // No replanning needed or max reached — break
            break;
        }

        // Log if max replans exceeded
        if (schedulerResult.needsReplanning && replanAttempts >= this.config.maxReplans) {
            console.warn(`[AgentOrchestrator] Max replanning attempts (${this.config.maxReplans}) exceeded`);
            this.emit('agent_orchestrator:max_replans_exceeded', {
                attempts: replanAttempts,
                reason: schedulerResult.replanFeedback?.reason,
                timestamp: Date.now()
            });
        }

        // Step 3: Aggregate - Alle Ergebnisse zusammenfassen
        return this._aggregateResults(schedulerResult, planResult, { replanAttempts });
    }

    /**
     * Planner Agent ausführen
     * @private
     */
    async _executePlanner(userMessage, messages, executionContext) {
        const planResult = await this.planner.invoke({
            userMessage,
            messages,
            executionContext,
        });
        console.log('[AgentOrchestrator] Plan created:', planResult.subtasks?.length || 0, 'subtasks');
        return planResult;
    }

    /**
     * Scheduler mit Executor + Critic ausführen
     * @private
     */
    async _executeScheduler(planResult, messages, executionContext) {
        this.emit('agent_orchestrator:scheduler', {
            status: 'scheduler_started',
            timestamp: Date.now(),
        });

        // Use agents from SessionContext (already wired up in constructor)
        const schedulerResult = await this.scheduler.execute({
            taskTree: planResult,
            agents: {
                executor: this.executor,
                critic: this.critic,
                planner: this.planner,
            },
            executionContext,
            messages,
        });

        console.log('[AgentOrchestrator] Scheduler execution result:', {
            goalCompleted: schedulerResult.goalCompleted,
            tasksCompleted: schedulerResult.metrics.tasksCompleted,
            tasksRun: schedulerResult.metrics.tasksRun,
            tasksFailed: schedulerResult.metrics.tasksFailed,
        });

        return schedulerResult;
    }

    /**
     * Alle Task-Ergebnisse aggregieren
     * @private
     */
    _aggregateResults(schedulerResult, planResult, metadata = {}) {
        const allToolCalls = [];
        const allToolResults = [];
        let finalAssistantMessage = '';
        const allUsage = [];  // Collect usage from all tasks

        // Sammle alle Tool-Calls und Results
        for (const taskResult of Object.values(schedulerResult.subtaskResults)) {
            if (taskResult.toolCalls) {
                allToolCalls.push(...taskResult.toolCalls);
            }
            if (taskResult.toolResults) {
                allToolResults.push(...taskResult.toolResults);
            }
            // ✨ Collect usage data
            if (taskResult.usage) {
                allUsage.push(taskResult.usage);
            }
        }

        // Nutze Assistant Message der letzten Task als finale Antwort
        const taskIds = Object.keys(schedulerResult.subtaskResults);
        if (taskIds.length > 0) {
            const lastTaskId = taskIds[taskIds.length - 1];
            const lastTaskResult = schedulerResult.subtaskResults[lastTaskId];
            if (lastTaskResult?.assistantMessage) {
                finalAssistantMessage = lastTaskResult.assistantMessage;
            }
        }

        // Aggregate usage from all tasks
        const aggregatedUsage = aggregateUsage(allUsage);

        return {
            allToolCalls,
            allToolResults,
            finalAssistantMessage,
            schedulerResult,
            planResult,
            aggregatedUsage,
            replanAttempts: metadata.replanAttempts || 0
        };
    }
}
