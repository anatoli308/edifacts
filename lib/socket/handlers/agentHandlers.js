import { loadProvider } from '../../ai/providers/index.js';
import { getAuthenticatedUser, getAnalysisChat } from '../../auth.js';
import { prepareConversation } from '../../utils/messageUtils.js';
import { createChatMessages } from '../../messageHelpers.js';
import { runEdifactAnalysis } from '../../utils/edifactAnalysisRunner.js';
import { randomUUID } from 'crypto';

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
 * Validate Agent Request (Authentication, Provider, etc)
 * Loads session data on first request and caches it in SessionContext
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

    const analysisChat = await getAnalysisChat(sessionId, authenticatedUser);
    if (!analysisChat) {
        throw new Error(`Analysis chat session not found`);
    }

    const chatSettings = analysisChat.settings || {};

    const provider = await loadProvider(authenticatedUser, {
        temperature: chatSettings.advanced?.temperature,
    });
    if (!provider) {
        throw new Error('Failed to load LLM provider for user');
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

        // Concurrent execution guard
        if (socket.sessionContext.isProcessing) {
            socket.emit('agent:failed', {
                error: 'A request is already being processed. Please wait.',
                errorType: 'concurrent_execution',
                timestamp: Date.now()
            });
            return;
        }
        socket.sessionContext.isProcessing = true;

        try {
            // Validate request and ensure session data is loaded
            const { userMessage, messages, context } =
                await _validateAgentRequest(request, socket);
            const sessionId = socket.sessionContext.analysisChat.id;

            // Emit agent started
            socket.emit('agent:started', {
                sessionId,
                timestamp: Date.now(),
            });

            //console.log(`[Socket ${socket.id}] provider loaded: `, socket.sessionContext.provider);
            //throw new Error('Test error handling'); // Test error handling

            // Prepare conversation messages for context (e.g. last 5 messages)
            const conversationMessages = prepareConversation(messages, 5);
            if (conversationMessages.length === 0) {
                console.log(`[Socket ${socket.id}] No messages - starting fresh conversation`);
            }

            let messageAnalysis = null;
            let rawEdifact = null;
            try {
                const analysisResult = await runEdifactAnalysis({
                    userMessage,
                    // messageFileId: future per-message file upload
                });
                if (analysisResult) {
                    messageAnalysis = analysisResult.analysis;
                    rawEdifact = analysisResult.rawEdifact;
                    console.log(`[Socket ${socket.id}] Per-message EDIFACT analysis: ${messageAnalysis.segmentCount} segments`);

                    // Emit analysis to frontend so the UI can display it
                    socket.emit('agent:analysis', {
                        analysis: messageAnalysis,
                        timestamp: Date.now()
                    });
                }
            } catch (analysisError) {
                console.warn(`[Socket ${socket.id}] EDIFACT analysis failed (non-blocking):`, analysisError.message);
            }

            // Persist rawEdifact in session so follow-up messages can access it
            if (rawEdifact) {
                socket.sessionContext.lastRawEdifact = rawEdifact;
            }
            // Fallback to session-stored rawEdifact for follow-up messages
            if (!rawEdifact && socket.sessionContext.lastRawEdifact) {
                rawEdifact = socket.sessionContext.lastRawEdifact;
                console.log(`[Socket ${socket.id}] Using session-stored rawEdifact for follow-up`);
            }

            // Build execution context (only execution-specific data, not session data)
            const executionContext = {
                ...context, // domain data, etc
                //Session data
                analysisChat: socket.sessionContext.analysisChat,
                authenticatedUser: socket.sessionContext.authenticatedUser,
                provider: socket.sessionContext.provider,
                // Per-message analysis (fresh from worker for this invoke)
                messageAnalysis,
                // Raw EDIFACT string for tool execution (tools need this as `raw` argument)
                rawEdifact
            };

            const orchestrator = socket.sessionContext.orchestrator;

            const result = await orchestrator.execute(
                userMessage,
                conversationMessages,
                executionContext
            );

            const endTime = Date.now();
            const duration_ms = endTime - startTime;

            // Save messages to database with usage tracking
            const savedIds = await _saveMessagesToDatabase({
                sessionId,
                userMessage,
                assistantMessage: result.finalAssistantMessage,
                agentPlan: result.planResult,
                toolCalls: result.allToolCalls,
                toolResults: result.allToolResults,
                usage: result.aggregatedUsage,  // From orchestrator
                messageAnalysis, // Per-message EDIFACT analysis
                metadata: {
                    duration_ms,
                    modelUsed: socket.sessionContext.provider.config.model,
                    timestamp: new Date()
                }
            });

            // Emit completion
            socket.emit('agent:completed', {
                sessionId,
                messageId: savedIds?.assistantMessageId ?? null,
                userMessageId: savedIds?.userMessageId ?? null,
                result: {
                    success: result.schedulerResult.goalCompleted,
                    assistantMessage: result.finalAssistantMessage,
                    taskTree: result.planResult,
                    toolCalls: result.allToolCalls,
                    toolResults: result.allToolResults,
                    schedulerMetrics: result.schedulerResult.metrics,
                    executionTrace: result.schedulerResult.executionTrace,
                    usage: result.aggregatedUsage
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
        } finally {
            socket.sessionContext.isProcessing = false;
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
    messageAnalysis,
    metadata
}) {
    const userMessageId = randomUUID();
    const assistantMessageId = randomUUID();
    try {
        const userMessageData = {
            id: userMessageId,
            role: 'user',
            content: userMessage,
            metadata: {
                timestamp: new Date()
            }
        };

        // Attach per-message EDIFACT analysis to user message
        if (messageAnalysis) {
            userMessageData.domainContext = {
                edifact: {
                    _analysis: messageAnalysis
                }
            };
        }

        const messagesData = [
            userMessageData,
            {
                id: assistantMessageId,
                role: 'assistant',
                content: assistantMessage || '',
                agentPlan,
                toolCalls: toolCalls || [],
                toolResults: toolResults || [],
                usage,  // LLM Usage tracking
                metadata: {
                    ...metadata,
                    timestamp: new Date()
                }
            }
        ];

        // Verwende Helper-Funktion für Bulk Insert
        await createChatMessages(sessionId, messagesData);

        console.log(`[Socket] Saved 2 messages to chat ${sessionId}`, {
            tokens: usage?.tokens?.total || 0,
            cost: usage?.cost?.total ? `$${usage.cost.total.toFixed(4)}` : 'N/A',
            latency: usage?.latency?.tokensPerSecond ? `${usage.latency.tokensPerSecond} tok/s` : 'N/A'
        });
        return { userMessageId, assistantMessageId };
    } catch (error) {
        console.error('[Socket] Failed to save messages:', error);
        // Don't throw - message saving shouldn't block execution
        return { userMessageId: null, assistantMessageId: null };
    }
}
