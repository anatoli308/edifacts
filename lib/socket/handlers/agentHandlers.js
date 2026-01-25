import { loadAgent } from '../../ai/agents/index.js';
import { loadProvider } from '../../ai/providers/index.js';

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
 * @param {Object} user - Authenticated user object. can be null for unauthenticated users
 */
export function registerAgentHandlers(socket, user) {
    socket.on('agent:invoke', handleAgentInvoke(socket, user));
    socket.on('agent:status', handleAgentStatus(socket, user));
    socket.on('agent:cancel', handleAgentCancel(socket, user));
}

/**
 * Agent Invocation Handler
 * Receives agent request, orchestrates execution, streams results
 * 
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Object} user - Authenticated user object. can be null for unauthenticated users
 * @returns {Function} Event handler function
 */
function handleAgentInvoke(socket, user) {
    return async (request) => {
        const startTime = Date.now();
        
        try {
            const { agentType, userMessage, sessionId, context } = request;

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

            // Validate user is authenticated
            if (!user) {
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
                provider = await loadProvider(user);
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

            // Prepare messages for agent
            const messages = [
                {
                    role: 'user',
                    content: userMessage,
                    timestamp: new Date().toISOString()
                }
            ];

            // Invoke agent
            const agentContext = {
                ...context,
                sessionId,
                userId: user._id,
                socket, // Pass socket for streaming if needed
            };

            let agentResult;
            try {
                agentResult = await agent.invoke({
                    messages,
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

            // For Router agent: result already contains orchestrated response
            if (agentType.toLowerCase() === 'router' && agentResult?.assistantMessage) {
                console.log(`[Socket Handler] Router returned orchestrated result. Intent: ${agentResult.intent}, Pipeline: ${agentResult.pipeline}`);
                
                // Emit task plan if available (from Planner)
                if (agentResult.taskTree) {
                    socket.emit('agent:plan', {
                        taskTree: agentResult.taskTree,
                        subtasks: agentResult.taskTree.subtasks || [],
                        timestamp: Date.now()
                    });
                }
                
                // Emit tool calls if any (from Executor)
                for (const toolCall of agentResult.toolCalls || []) {
                    socket.emit('agent:tool_call', {
                        tool: toolCall.tool,
                        arguments: toolCall.arguments,
                        callId: toolCall.id,
                        timestamp: Date.now()
                    });
                }
                
                // Emit tool results if any
                for (const toolResult of agentResult.toolResults || []) {
                    socket.emit('agent:tool_result', {
                        tool: toolResult.tool,
                        result: toolResult.result,
                        success: toolResult.success,
                        timestamp: Date.now()
                    });
                }
                
                // Emit final response
                socket.emit('response:chunk', {
                    content: agentResult.assistantMessage,
                    role: 'assistant',
                    isComplete: true,
                    timestamp: Date.now()
                });
            } // End of if (Router)

            // Stream agent result (for non-Router agents, Planner, Executor, etc)
            if (agentResult?.taskTree) {
                // Planner result: emit task tree
                socket.emit('agent:plan', {
                    taskTree: agentResult.taskTree,
                    goals: agentResult.taskTree.goals,
                    subtasks: agentResult.taskTree.subtasks,
                    timestamp: Date.now()
                });
            }

            if (agentResult?.toolCalls?.length > 0) {
                // Executor result: emit tool calls and results
                for (const toolCall of agentResult.toolCalls) {
                    socket.emit('agent:tool_call', {
                        tool: toolCall.tool,
                        arguments: toolCall.arguments,
                        callId: toolCall.id,
                        timestamp: Date.now()
                    });
                }

                for (const toolResult of agentResult.toolResults || []) {
                    socket.emit('agent:tool_result', {
                        tool: toolResult.tool,
                        result: toolResult.result,
                        success: toolResult.success,
                        duration_ms: toolResult.duration_ms,
                        callId: toolResult.callId,
                        timestamp: Date.now()
                    });
                }
            }

            if (agentResult?.assistantMessage && agentType.toLowerCase() !== 'router') {
                // Stream assistant response (only for non-Router agents)
                const assistantContent = agentResult.assistantMessage;
                if (typeof assistantContent === 'string') {
                    socket.emit('response:chunk', {
                        content: assistantContent,
                        role: 'assistant',
                        isComplete: true,
                        timestamp: Date.now()
                    });
                } else if (assistantContent?.content) {
                    socket.emit('response:chunk', {
                        content: assistantContent.content,
                        role: 'assistant',
                        isComplete: true,
                        timestamp: Date.now()
                    });
                }
            }

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
 * @param {Object} user - Authenticated user object
 * @returns {Function} Event handler function
 */
function handleAgentStatus(socket, user) {
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
 * @param {Object} user - Authenticated user object
 * @returns {Function} Event handler function
 */
function handleAgentCancel(socket, user) {
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
