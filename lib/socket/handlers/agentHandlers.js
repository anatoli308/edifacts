import { loadAgent } from '../../ai/agents/index.js';
import { loadProvider } from '../../ai/providers/index.js';
import { getAuthenticatedUser } from '../../auth.js';
/**
 * Filter conversation messages for LLM context
 * Removes tool-related messages and keeps only last N conversation turns
 * @param {Array} messages - Full message history
 * @param {number} maxMessages - Maximum messages to keep (default: 5)
 * @returns {Array} Filtered messages suitable for LLM context
 */
function filterContextMessages(messages, maxMessages = 5) {
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
 * - agent:step - Executor step progress
 * - agent:tool_call - Tool invocation
 * - agent:tool_result - Tool execution result
 * - agent:observation - ReAct observation
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
            const { agentType, userMessage, sessionId, messages, context } = request;

            console.log(`[Socket ${socket.id}] Agent invocation: ${agentType} for session ${sessionId}`);

            // Validate request
            if (!agentType || !userMessage || !sessionId) {
                socket.emit('agent:failed', {
                    error: 'Missing required fields: agentType, userMessage, sessionId',
                    errorType: 'validation_error',
                    timestamp: Date.now()
                });
                return;
            }

            const authenticatedUser = await getAuthenticatedUser(socket.userId, socket.token);
            // Validate user is authenticated
            if (!authenticatedUser) {
                socket.emit('agent:failed', {
                    error: 'Authentication required',
                    errorType: 'auth_error',
                    timestamp: Date.now()
                });
                return;
            }

            // Load agent based on agentType
            let agent;
            try {
                agent = loadAgent(agentType);
            } catch (e) {
                socket.emit('agent:failed', {
                    error: `Unknown agent: ${agentType}. Available: router, planner, executor, critic, memory, recovery`,
                    errorType: 'agent_not_found',
                    timestamp: Date.now()
                });
                return;
            }

            // Load provider from user config (BYOK or managed vLLM)
            let provider;
            try {
                provider = await loadProvider(authenticatedUser);
            } catch (e) {
                socket.emit('agent:failed', {
                    error: `Provider configuration error: ${e.message}`,
                    errorType: 'provider_error',
                    timestamp: Date.now()
                });
                return;
            }

            // Emit agent started
            socket.emit('agent:started', {
                agentName: agentType,
                sessionId,
                timestamp: Date.now()
            });

            // Prepare messages for agent: use explicit messages parameter
            let conversationMessages;
            if (messages && Array.isArray(messages) && messages.length > 0) {
                // Filter messages to avoid token explosion (max 5 turns, frontend sends full history in useAgentStreaming)
                conversationMessages = filterContextMessages(messages, 5);
            } else {
                // No messages: create fresh conversation with current user message
                console.log('[Agent Handler] No messages - starting fresh conversation');
                conversationMessages = [
                    {
                        role: 'user',
                        content: userMessage,
                        timestamp: new Date().toISOString()
                    }
                ];
            }

            console.log(`[Agent Handler] Final message count for agent: ${conversationMessages.length} (max 5, excluding tool-only)`);

            // Invoke agent with clean context (no duplicate messages in context object)
            const agentContext = {
                ...context, // Domain data only (no latestMessages)
                sessionId,
                userId: authenticatedUser._id,
                socket, // Pass socket for streaming
            };

            let agentResult;
            try {
                //throw new Error('TODO: anatoli Agent execution not implemented in this environment');
                agentResult = await agent.invoke({
                    messages: conversationMessages, //max latest 5
                    context: agentContext,
                    provider,
                });
            } catch (e) {
                console.error('Agent execution error:', e);
                socket.emit('agent:failed', {
                    error: `Agent execution failed: ${e.message}`,
                    errorType: 'execution_error',
                    timestamp: Date.now()
                });
                return;
            }            
            console.log(`[Socket Handler] Agent execution completed. Intent: ${agentResult?.intent}, Pipeline: ${agentResult?.pipeline}`);

            // Emit completion
            const duration_ms = Date.now() - startTime;
            socket.emit('agent:completed', {
                agentName: agentType,
                sessionId,
                result: {
                    success: true,
                    agentType,
                    intent: agentResult?.intent,
                    pipeline: agentResult?.pipeline,
                    hasToolCalls: (agentResult?.toolCalls?.length || 0) > 0,
                    hasTaskPlan: !!agentResult?.taskTree,
                },
                duration_ms,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error(`[Socket ${socket.id}] Agent invocation error:`, error);
            socket.emit('agent:failed', {
                error: error.message,
                errorType: 'execution_error',
                timestamp: Date.now()
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
function handleAgentStatus(socket) {
    return async ({ sessionId, executionId }) => {
        try {
            // TODO: Query execution status from database or memory
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
