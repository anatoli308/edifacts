import { loadProvider } from '../../ai/providers/index.js';
import { getAuthenticatedUser, getAnalysisChat } from '../../auth.js';
import { prepareConversation } from '../../utils/messageUtils.js';
import { calculateUsage } from '../../utils/usageCalculator.js';

/**
 * Socket.IO Agent Event Handlers
 * ===============================
 * Handles real-time agent orchestration via WebSocket
 * 
 * Events:
 * - agent:invoke - Start agent execution
 * - agent:status - Query agent execution status (reconnect and history sinnvoll)
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

/**
 * Validiere Agent-Request (Authentication, Provider, etc)
 * Lädt Session-Daten beim ersten Request und cached sie in SessionContext
 * @private
 */
async function _validateAgentRequest(request, socket) {
    const { userMessage, sessionId, messages, context } = request;

    // Validate basic fields
    if (!userMessage || !sessionId) {
        throw new Error('Missing required fields: userMessage, sessionId');
    }

    // Check if session data already loaded
    // First request - load and cache session data
    const authenticatedUser = await getAuthenticatedUser(socket.userId, socket.token);
    if (!authenticatedUser) {
        throw new Error('Authentication required');
    }

    const provider = await loadProvider(authenticatedUser);
    if (!provider) {
        throw new Error('Failed to load LLM provider for user');
    }

    const analysisChat = await getAnalysisChat(sessionId, authenticatedUser);
    if (!analysisChat) {
        throw new Error(`Analysis chat session not found`);
    }

    socket.sessionContext.initializeSession(authenticatedUser, provider, analysisChat);

    // Return session data from SessionContext
    return {
        userMessage,
        messages,
        context
    };
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
        let firstTokenTime = null;

        try {
            // Validate request and ensure session data is loaded
            const { userMessage, messages, context } =
                await _validateAgentRequest(request, socket);
            const sessionId = socket.sessionContext.analysisChat._id.toString();

            // Emit agent started
            socket.emit('agent:started', {
                sessionId,
                timestamp: Date.now(),
            });

            // Track first token time (for TTFT latency)
            const trackFirstToken = () => {
                if (!firstTokenTime) {
                    firstTokenTime = Date.now();
                }
            };
            socket.sessionContext.orchestrator.once('response:chunk', trackFirstToken);

            // Prepare conversation messages
            const conversationMessages = prepareConversation(messages, 5);
            if (conversationMessages.length === 0) {
                console.log(`[Socket ${socket.id}] No messages - starting fresh conversation`);
            }

            // Build execution context (only execution-specific data, not session data)
            const executionContext = {
                ...context, // domain data, etc
                //Session data 
                analysisChat: { ...socket.sessionContext.analysisChat },  // Shallow Copy
                authenticatedUser: { ...socket.sessionContext.authenticatedUser },  // Shallow Copy
                provider: socket.sessionContext.provider  // ← OK, Provider ist immutable
            };

            const orchestrator = socket.sessionContext.orchestrator;

            const result = await orchestrator.execute(
                userMessage,
                conversationMessages,
                executionContext
            );

            const endTime = Date.now();
            const duration_ms = endTime - startTime;

            // Calculate aggregated usage from all executions
            const timing = {
                startTime,
                firstTokenTime,
                endTime
            };

            // Save messages to database with usage tracking
            await _saveMessagesToDatabase({
                sessionId,
                userMessage,
                assistantMessage: result.finalAssistantMessage,
                agentPlan: result.planResult,
                toolCalls: result.allToolCalls,
                toolResults: result.allToolResults,
                usage: result.aggregatedUsage,  // From orchestrator
                metadata: {
                    duration_ms,
                    modelUsed: socket.sessionContext.provider.config.model,
                    timestamp: new Date()
                }
            });

            // Emit completion
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
                    usage: result.aggregatedUsage  // ✨ Include usage in response
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

/**
 * Save conversation messages to database with usage tracking
 * @private
 */
async function _saveMessagesToDatabase({
    sessionId,
    userMessage,
    assistantMessage,
    agentPlan,
    toolCalls,
    toolResults,
    usage,
    metadata
}) {
    try {
        const AnalysisChat = (await import('../../../models/edifact/AnalysisChat.js')).default;
        
        const userMsg = {
            role: 'user',
            content: userMessage,
            metadata: {
                timestamp: new Date()
            }
        };

        const assistantMsg = {
            role: 'assistant',
            content: assistantMessage || '',
            agentPlan,
            toolCalls: toolCalls || [],
            toolResults: toolResults || [],
            usage,  // ✨ LLM Usage tracking
            metadata: {
                ...metadata,
                timestamp: new Date()
            }
        };

        // Update chat with new messages
        await AnalysisChat.findByIdAndUpdate(
            sessionId,
            {
                $push: {
                    messages: {
                        $each: [userMsg, assistantMsg]
                    }
                }
            },
            { new: true }
        );

        console.log(`[Socket] Saved 2 messages to chat ${sessionId}`, {
            tokens: usage?.tokens?.total || 0,
            cost: usage?.cost?.total ? `$${usage.cost.total.toFixed(4)}` : 'N/A',
            latency: usage?.latency?.tokensPerSecond ? `${usage.latency.tokensPerSecond} tok/s` : 'N/A'
        });
    } catch (error) {
        console.error('[Socket] Failed to save messages:', error);
        // Don't throw - message saving shouldn't block execution
    }
}
