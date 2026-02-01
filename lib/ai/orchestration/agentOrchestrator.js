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

export class AgentOrchestrator extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = config;
        
        // Required agents from SessionContext
        this.planner = config.planner || null;
        this.scheduler = config.scheduler || null;
        this.executor = config.executor || null;
        this.critic = config.critic || null;

        if (!this.planner || !this.scheduler || !this.executor || !this.critic) {
            throw new Error('All agents (planner, scheduler, executor, critic) are required for AgentOrchestrator');
        }
    }

    /**
     * Führe kompletten Agent-Pipeline aus (Planner → Scheduler → Aggregation)
     * @param {string} userMessage - User input
     * @param {Array} conversationMessages - Chat history
     * @param {object} agentContext - Execution context (domain, etc)
     * @param {object} provider - LLM provider
     * @returns {Promise<object>} Aggregierte Ergebnisse
     */
    async execute(userMessage, conversationMessages, agentContext, provider) {
        // Step 1: Plan - Benutzer-Goal in Task-Tree zerlegen
        const planResult = await this._executePlanner(
            userMessage,
            conversationMessages,
            agentContext,
            provider,
        );

        // Step 2: Schedule & Execute - Task-Tree ausführen mit Executor + Critic
        const schedulerResult = await this._executeScheduler(
            planResult,
            conversationMessages,
            agentContext,
            provider
        );

        // Step 3: Aggregate - Alle Ergebnisse zusammenfassen
        return this._aggregateResults(schedulerResult, planResult);
    }

    /**
     * Planner Agent ausführen
     * @private
     */
    async _executePlanner(userMessage, messages, context, provider) {
        const planResult = await this.planner.invoke({
            userMessage,
            messages,
            context,
            provider,
        });
        console.log('[AgentOrchestrator] Plan created:', planResult.subtasks?.length || 0, 'subtasks');
        return planResult;
    }

    /**
     * Scheduler mit Executor + Critic ausführen
     * @private
     */
    async _executeScheduler(planResult, messages, context, provider) {
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
            context,
            messages,
            provider,
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
    _aggregateResults(schedulerResult, planResult) {
        const allToolCalls = [];
        const allToolResults = [];
        let finalAssistantMessage = '';

        // Sammle alle Tool-Calls und Results
        for (const taskResult of Object.values(schedulerResult.subtaskResults)) {
            if (taskResult.toolCalls) {
                allToolCalls.push(...taskResult.toolCalls);
            }
            if (taskResult.toolResults) {
                allToolResults.push(...taskResult.toolResults);
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

        return {
            allToolCalls,
            allToolResults,
            finalAssistantMessage,
            schedulerResult,
            planResult,
        };
    }
}
