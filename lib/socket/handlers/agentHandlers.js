import { loadAgent } from '../../ai/agents/index.js';
import { loadProvider } from '../../ai/providers/index.js';
import { getAuthenticatedUser } from '../../auth.js';
/**
 * Filter conversation messages for LLM context
 * Removes tool-related messages and keeps only last N conversation turns
 * @param {Array} messages - Full message history
 * @param {number} maxMessages - Maximum messages to keep 
 * @returns {Array} Filtered messages suitable for LLM context
 */
function filterContextMessages(messages, maxMessages) {
    if (!messages || !Array.isArray(messages)) return [];

    // Filter: keep user messages and assistant messages (exclude tool-only messages)
    const filtered = messages.filter(m => {
        if (m.role === 'user') return true;
        if (m.role === 'assistant' && m.content) {
            // Include assistant messages that have text content (not just tool calls)
            return typeof m.content === 'string' || (m.content.text && m.content.text.trim());
        }
        return false;
    });

    // Keep only last N messages to avoid context explosion
    return filtered.slice(-maxMessages);
}

/**
 * Socket.IO Agent Event Handlers
 * ===============================
 * Handles real-time agent orchestration via WebSocket
 * 
 * Events:
 * - agent:invoke - Start agent execution
 * - agent:status - Query agent execution status
 * - agent:cancel - Cancel running agent execution
 * 
 * Emits:
 * - agent:started - Agent execution started
 * - agent:plan - Task tree from Planner
 * - agent:scheduler - Scheduler status updates
 * - agent:step - Executor step progress
 * - agent:tool_call - Tool invocation
 * - agent:tool_result - Tool execution result
 * - agent:observation - ReAct observation
 * - agent:reasoning - Agent reasoning step
 * - response:chunk - LLM response streaming
 * - agent:completed - Agent execution completed
 * - agent:failed - Agent execution failed
 */

/**
 * Register all agent-related Socket.IO event handlers
 * @param {Socket} socket - Socket.IO socket instance
 */
export function registerAgentHandlers(socket) {
    socket.on('agent:invoke', handleAgentInvoke(socket));
    socket.on('agent:status', handleAgentStatus(socket));
    socket.on('agent:cancel', handleAgentCancel(socket));
}

/**
 * Agent Invocation Handler
 * Receives agent request, orchestrates execution, streams results
 * 
 * @param {Socket} socket - Socket.IO socket instance
 * @returns {Function} Event handler function
 */
function handleAgentInvoke(socket) {
    return async (request) => {
        const startTime = Date.now();

        try {
            const { userMessage, sessionId, messages, context } = request;

            console.log(`[Socket ${socket.id}] Agent for session ${sessionId}`);

            // Validate request
            if (!userMessage || !sessionId) {
                socket.emit('agent:failed', {
                    error: 'Missing required fields: userMessage, sessionId',
                    errorType: 'validation_error',
                });
                return;
            }

            const authenticatedUser = await getAuthenticatedUser(socket.userId, socket.token);
            // Validate user is authenticated
            if (!authenticatedUser) {
                socket.emit('agent:failed', {
                    error: 'Authentication required',
                    errorType: 'auth_error',
                });
                return;
            }

            // Load provider from user config (BYOK or managed vLLM)
            const provider = await loadProvider(authenticatedUser);
            if (!provider) {
                socket.emit('agent:failed', {
                    error: 'Failed to load LLM provider for user',
                    errorType: 'provider_error',
                });
                return;
            }

            // Emit agent started
            socket.emit('agent:started', {
                sessionId,
                timestamp: Date.now()
            });

            let conversationMessages = _prepareConversation(messages, 5);
            if (conversationMessages.length === 0) {
                console.log('[Agent Handler] No messages - starting fresh conversation');
            }

            // Invoke agent with clean context (no duplicate messages in context object)
            const agentContext = {
                ...context, // Domain data only (no conversation messages)
                sessionId,
                userId: authenticatedUser._id,
                socket, // Pass socket for streaming
            };

            // Step 1: Planner - decompose user goal into a task tree
            socket.emit('agent:plan', {
                status: 'planner_started',
                subtasks: [],
                rationale: '',
                goal: userMessage,
                timestamp: Date.now(),
            });

            const planner = loadAgent('planner');
            const planResult = await planner.invoke({
                userMessage: userMessage,
                messages: conversationMessages,
                context: agentContext,
                provider,
            });

            console.log('[Agent Handler] Plan created:', planResult.subtasks?.length || 0, 'subtasks');

            // Step 2: Scheduler - start orchestrate task execution with Executor + Critic
            socket.emit('agent:scheduler', {
                status: 'scheduler_started',
                timestamp: Date.now()
            });

            const { Scheduler } = await import('../../ai/orchestration/index.js');
            const scheduler = new Scheduler({
                maxParallel: 2,
                timeoutPerTaskMs: 60000,
                enableMetrics: true
            });

            const executor = loadAgent('executor');
            const critic = loadAgent('critic');

            const schedulerResult = await scheduler.execute({
                taskTree: planResult,
                agents: {
                    executor,
                    critic,
                    planner
                },
                context: agentContext,
                messages: conversationMessages,
                userMessage,
                provider,
            });

            console.log('[Agent Handler] Scheduler execution result:', {
                goalCompleted: schedulerResult.goalCompleted,
                tasksCompleted: schedulerResult.metrics.tasksCompleted,
                tasksRun: schedulerResult.metrics.tasksRun,
                tasksFailed: schedulerResult.metrics.tasksFailed
            });

            // Step 3: Aggregate results
            const allToolCalls = [];
            const allToolResults = [];
            let finalAssistantMessage = '';

            const taskIds = Object.keys(schedulerResult.subtaskResults);

            for (const [taskId, taskResult] of Object.entries(schedulerResult.subtaskResults)) {
                if (taskResult.toolCalls) {
                    allToolCalls.push(...taskResult.toolCalls);
                }
                if (taskResult.toolResults) {
                    allToolResults.push(...taskResult.toolResults);
                }
            }

            // Use LAST task's assistant message as final answer
            if (taskIds.length > 0) {
                const lastTaskId = taskIds[taskIds.length - 1];
                const lastTaskResult = schedulerResult.subtaskResults[lastTaskId];
                if (lastTaskResult && lastTaskResult.assistantMessage) {
                    finalAssistantMessage = lastTaskResult.assistantMessage;
                }
            }

            // Emit completion
            const duration_ms = Date.now() - startTime;
            socket.emit('agent:completed', {
                sessionId,
                result: {
                    success: schedulerResult.goalCompleted,
                    assistantMessage: finalAssistantMessage || 'Keine Antwort generiert.',
                    taskTree: planResult,
                    toolCalls: allToolCalls,
                    toolResults: allToolResults,
                    schedulerMetrics: schedulerResult.metrics,
                    executionTrace: schedulerResult.executionTrace
                },
                duration_ms,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error(`[Socket ${socket.id}] Agent execution error:`, error);
            socket.emit('agent:failed', {
                error: error.message,
                errorType: 'execution_error',
                timestamp: Date.now()
            });
        }
    };
}

function _prepareConversation(messages, maxMessages = 5) {
    if (messages && Array.isArray(messages) && messages.length > 0) {
        // Filter messages to avoid token explosion (max 5 turns, frontend sends full history in useAgentStreaming)
        const conversationMessages = filterContextMessages(messages, maxMessages);
        console.log(`[Agent Handler] Final message count for agent: ${conversationMessages.length} (max 5, excluding tool-only)`);
        return conversationMessages;
    }
    return [];
}

/**
 * Agent Status Check Handler
 * Query current status of an agent execution
 * 
 * @param {Socket} socket - Socket.IO socket instance
 * @returns {Function} Event handler function
 */
function handleAgentStatus(socket) {
    return async ({ sessionId, executionId }) => {
        try {
            // TODO: implement Query execution status from database or memory
            // const status = await getExecutionStatus(sessionId, executionId);

            socket.emit('agent:status_response', {
                sessionId,
                executionId,
                status: 'running', // or 'completed', 'failed', 'pending'
                currentStep: 'tool_execution',
                timestamp: Date.now()
            });
        } catch (error) {
            console.error(`[Socket ${socket.id}] Agent status error:`, error);
            socket.emit('agent:status_error', { error: error.message });
        }
    };
}

/**
 * Agent Cancellation Handler
 * Cancel a running agent execution
 * 
 * @param {Socket} socket - Socket.IO socket instance
 * @returns {Function} Event handler function
 */
function handleAgentCancel(socket) {
    return async ({ sessionId, executionId }) => {
        try {
            console.log(`[Socket ${socket.id}] Canceling agent execution: ${executionId}`);

            // TODO: Implement cancellation logic
            // await cancelExecution(sessionId, executionId);

            socket.emit('agent:cancelled', {
                sessionId,
                executionId,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error(`[Socket ${socket.id}] Agent cancel error:`, error);
            socket.emit('agent:cancel_error', { error: error.message });
        }
    };
}
