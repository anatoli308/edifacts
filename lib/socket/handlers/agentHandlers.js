import { loadProvider } from '../../ai/providers/index.js';
import { getAuthenticatedUser } from '../../auth.js';
import { prepareConversation } from '../../utils/messageUtils.js';

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
    socket.on('agent:invoke', _handleAgentInvoke(socket));
    socket.on('agent:status', _handleAgentStatus(socket));
    socket.on('agent:cancel', _handleAgentCancel(socket));
}

export function unregisterAgentHandlers(socket) {
    socket.off('agent:invoke');
    socket.off('agent:status');
    socket.off('agent:cancel');
}

/**
 * Validiere Agent-Request (Authentication, Provider, etc)
 * @private
 */
async function _validateAgentRequest(request, socket) {
    const { userMessage, sessionId, messages, context } = request;

    // Validate basic fields
    if (!userMessage || !sessionId) {
        throw new Error('Missing required fields: userMessage, sessionId');
    }

    // Validate user is authenticated
    const authenticatedUser = await getAuthenticatedUser(socket.userId, socket.token);
    if (!authenticatedUser) {
        throw new Error('Authentication required');
    }

    // Load provider from user config (BYOK or managed vLLM)
    const provider = await loadProvider(authenticatedUser);
    if (!provider) {
        throw new Error('Failed to load LLM provider for user');
    }

    return { userMessage, sessionId, messages, context, authenticatedUser, provider };
}

/**
 * Agent Invocation Handler
 * Receives agent request, orchestrates execution, streams results
 * 
 * @param {Socket} socket - Socket.IO socket instance
 * @returns {Function} Event handler function
 */
function _handleAgentInvoke(socket) {
    return async (request) => {
        const startTime = Date.now();

        try {
            // Validate request and load provider
            const { userMessage, sessionId, messages, context, authenticatedUser, provider } =
                await _validateAgentRequest(request, socket);

            console.log(`[Socket ${socket.id}] Agent for session ${sessionId}`);

            // Reset all agents before new execution
            socket.sessionContext.resetAgents();

            // Emit agent started
            socket.emit('agent:started', {
                sessionId,
                timestamp: Date.now(),
            });

            // Prepare conversation messages
            const conversationMessages = prepareConversation(messages, 5);
            if (conversationMessages.length === 0) {
                console.log('[Agent Handler] No messages - starting fresh conversation');
            }

            // Build agent context
            const agentContext = {
                ...context, // Domain data only (no conversation messages)
                sessionId,
                userId: authenticatedUser._id,
            };

            const orchestrator = socket.sessionContext.orchestrator;

            const result = await orchestrator.execute(
                userMessage,
                conversationMessages,
                agentContext,
                provider
            );

            // Emit completion
            const duration_ms = Date.now() - startTime;
            socket.emit('agent:completed', {
                sessionId,
                result: {
                    success: result.schedulerResult.goalCompleted,
                    assistantMessage: result.finalAssistantMessage || 'Keine Antwort generiert.',
                    taskTree: result.planResult,
                    toolCalls: result.allToolCalls,
                    toolResults: result.allToolResults,
                    schedulerMetrics: result.schedulerResult.metrics,
                    executionTrace: result.schedulerResult.executionTrace,
                },
                duration_ms,
                timestamp: Date.now(),
            });
        } catch (error) {
            console.error(`[Socket ${socket.id}] Agent execution error:`, error);
            socket.emit('agent:failed', {
                error: error.message,
                errorType: 'execution_error',
                timestamp: Date.now(),
            });
        }
    };
}


/**
 * Agent Status Check Handler
 * Query current status of an agent execution
 * 
 * @param {Socket} socket - Socket.IO socket instance
 * @returns {Function} Event handler function
 */
function _handleAgentStatus(socket) {
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
function _handleAgentCancel(socket) {
    return async (request = {}) => {
        console.log(`[Socket ${socket.id}] Cancel request received:`, request);
        // TODO: Implement cancel logic if needed in future
        socket.emit('agent:cancel_error', {
            error: 'Cancel not yet implemented',
            timestamp: Date.now(),
        });
    };
}
