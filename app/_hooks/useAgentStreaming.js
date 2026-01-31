/**
 * Custom Hook: useAgentStreaming
 * Handles real-time agent execution streaming via Socket.IO
 * 
 * Features:
 * - Listens to agent lifecycle events (started, plan, step, tool_call, etc)
 * - Accumulates streaming response chunks
 * - Updates message state in real-time via callback
 * - Error handling and recovery
 * 
 * @param {string} sessionId - Current chat session ID
 * @param {Function} onMessageUpdate - Callback called when message updates (optional)
 * @returns {Object} - { sendAgentMessage, getCurrentMessage, currentAgentState, isStreaming }
 * 
 * sendAgentMessage signature:
 * @param {string} userMessage - User's message content
 * @param {string} agentType - Agent to invoke (default: 'Router')
 * @param {Array} messages - Conversation history (array of {role, content} objects)
 * @param {Object} context - Additional context (domain data, sessionId, etc)
 */

import { useEffect, useRef, useState, useCallback } from 'react';

import { useSocket } from '@/app/_contexts/SocketContext';
import { useSnackbar } from '@/app/_contexts/SnackbarContext';

/**
 * Log agentState changes with context
 * @param {Object} prevState - Previous state
 * @param {Object} newState - New state
 * @param {string} event - Event that triggered the change
 * @param {Object} data - Event data
 */
const logEnabled = false;
function logAgentState(prevState, newState, event, data) {
    if (!logEnabled) return;
    console.group(`[AgentState] ${event}`);
    console.log('Timestamp:', new Date().toISOString());
    console.log('Previous state:', prevState);
    console.log('New state:', newState);
    if (data) {
        console.log('Event data:', data);
    }
    console.groupEnd();
}

export function useAgentStreaming(sessionId, onMessageUpdate) {
    const { socket } = useSocket();
    const { pushSnackbarMessage } = useSnackbar();

    const [currentAgentState, setCurrentAgentState] = useState({
        status: 'idle',
        agentName: null,
        timestamp: null,
        plan: null,
        steps: [],
        toolCalls: [],
        observations: []
    });
    const [isStreaming, setIsStreaming] = useState(false);
    const currentMessageRef = useRef(null);

    useEffect(() => {
        if (!socket) return;

        // Agent Started
        const handleAgentStarted = (data) => {
            console.log('[Agent] Started:', data);
            const newState = {
                agentName: data.agentName,
                status: 'started',
                timestamp: data.timestamp,
                plan: null,
                steps: [],
                toolCalls: [],
                observations: []
            };
            logAgentState(currentAgentState, newState, 'AGENT_STARTED', data);
            setCurrentAgentState(newState);
            setIsStreaming(true);

            // Initialize new assistant message
            currentMessageRef.current = {
                role: 'assistant',
                content: {
                    reasoning: '',
                    steps: [],
                    toolCalls: [],
                    text: '',
                    status: 'streaming'
                },
                timestamp: new Date().toISOString()
            };
            
            // Trigger update callback
            if (onMessageUpdate) {
                onMessageUpdate(currentMessageRef.current);
            }
        };

        // Agent Plan (HTN Task Tree)
        const handleAgentPlan = (data) => {
            console.log('[Agent] Plan:', data);
            setCurrentAgentState(prev => {
                const newState = {
                    ...prev,
                    plan: data.taskTree,
                    tasks: data.tasks
                };
                logAgentState(prev, newState, 'AGENT_PLAN_RECEIVED', data);
                return newState;
            });

            if (currentMessageRef.current) {
                currentMessageRef.current.content.reasoning = 'Planning task execution...';
                if (onMessageUpdate) {
                    onMessageUpdate(currentMessageRef.current);
                }
            }
        };

        // Agent Reasoning (internal thoughts during task execution)
        const handleAgentReasoning = (data) => {
            console.log('[Agent] Reasoning:', data);
            
            if (data.isComplete) {
                // Reasoning complete - clear it
                setCurrentAgentState(prev => ({
                    ...prev,
                    reasoning: ''
                }));
            } else {
                // Accumulate reasoning chunks
                setCurrentAgentState(prev => ({
                    ...prev,
                    reasoning: (prev.reasoning || '') + data.content
                }));
            }

            if (currentMessageRef.current && !data.isComplete) {
                // Don't persist reasoning in message, just show during streaming
                if (onMessageUpdate) {
                    onMessageUpdate(currentMessageRef.current);
                }
            }
        };

        // Agent Step
        const handleAgentStep = (data) => {
            console.log('[Agent] Step:', data);
            setCurrentAgentState(prev => {
                const newState = {
                    ...prev,
                    steps: [...(prev?.steps || []), data]
                };
                logAgentState(prev, newState, 'AGENT_STEP', data);
                return newState;
            });

            if (currentMessageRef.current) {
                currentMessageRef.current.content.steps.push(data.stepName);
                if (onMessageUpdate) {
                    onMessageUpdate(currentMessageRef.current);
                }
            }
        };

        // Tool Call
        const handleToolCall = (data) => {
            console.log('[Agent] Tool Call:', data);
            setCurrentAgentState(prev => {
                const newState = {
                    ...prev,
                    toolCalls: [...(prev?.toolCalls || []), { ...data, status: 'calling' }]
                };
                logAgentState(prev, newState, 'TOOL_CALL', data);
                return newState;
            });

            if (currentMessageRef.current) {
                if (onMessageUpdate) {
                    onMessageUpdate(currentMessageRef.current);
                }
            }
        };

        // Tool Result
        const handleToolResult = (data) => {
            console.log('[Agent] Tool Result:', data);
            setCurrentAgentState(prev => {
                const updatedToolCalls = prev?.toolCalls.map(call =>
                    call.callId === data.callId
                        ? { ...call, status: 'completed', result: data.result, duration_ms: data.duration_ms }
                        : call
                ) || [];
                const newState = { ...prev, toolCalls: updatedToolCalls };
                logAgentState(prev, newState, 'TOOL_RESULT', data);
                return newState;
            });

            if (currentMessageRef.current) {
                currentMessageRef.current.content.toolCalls.push({
                    name: data.tool,
                    result: typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2)
                });
                if (onMessageUpdate) {
                    onMessageUpdate(currentMessageRef.current);
                }
            }
        };

        // Response Chunk - TRIGGERS MOST FREQUENTLY
        const handleResponseChunk = (data) => {
            if (currentMessageRef.current) {
                currentMessageRef.current.content.text += data.content;
                // Trigger update callback on every chunk
                if (onMessageUpdate) {
                    onMessageUpdate(currentMessageRef.current);
                }
            }
        };

        // Agent Completed
        const handleAgentCompleted = (data) => {
            console.log('[Agent] Completed:', data);
            setIsStreaming(false);
            setCurrentAgentState(prev => {
                const newState = { ...prev, status: 'completed', result: data.result };
                logAgentState(prev, newState, 'AGENT_COMPLETED', data);
                return newState;
            });
            
            // Transition to idle after a brief delay
            setTimeout(() => {
                setCurrentAgentState(prev => {
                    const idleState = {
                        status: 'idle',
                        agentName: null,
                        timestamp: null,
                        plan: null,
                        steps: [],
                        toolCalls: [],
                        observations: []
                    };
                    logAgentState(prev, idleState, 'AGENT_IDLE', null);
                    return idleState;
                });
            }, 500);

            if (currentMessageRef.current) {
                currentMessageRef.current.content.status = 'completed';
                if (onMessageUpdate) {
                    onMessageUpdate(currentMessageRef.current);
                }
            }
        };

        // Agent Failed
        const handleAgentFailed = (data) => {
            console.error('[Agent] Failed:', data);
            pushSnackbarMessage(`Agent failed: ${data.error}`, 'error');
            setIsStreaming(false);
            setCurrentAgentState(prev => {
                const newState = { ...prev, status: 'failed', error: data.error };
                logAgentState(prev, newState, 'AGENT_FAILED', data);
                return newState;
            });
            
            // Transition to idle after a brief delay
            setTimeout(() => {
                setCurrentAgentState(prev => {
                    const idleState = {
                        status: 'idle',
                        agentName: null,
                        timestamp: null,
                        plan: null,
                        steps: [],
                        toolCalls: [],
                        observations: []
                    };
                    logAgentState(prev, idleState, 'AGENT_IDLE', null);
                    return idleState;
                });
            }, 500);

            if (currentMessageRef.current) {
                currentMessageRef.current.content.status = 'failed';
                currentMessageRef.current.content.text = `Error: ${data.error}`;
                if (onMessageUpdate) {
                    onMessageUpdate(currentMessageRef.current);
                }
            }
        };

        console.log('[Agent] Registering event listeners');
        // Register event listeners
        socket.on('agent:started', handleAgentStarted);
        socket.on('agent:plan', handleAgentPlan);
        socket.on('agent:reasoning', handleAgentReasoning);
        socket.on('agent:step', handleAgentStep);
        socket.on('agent:tool_call', handleToolCall);
        socket.on('agent:tool_result', handleToolResult);
        socket.on('response:chunk', handleResponseChunk);
        socket.on('agent:completed', handleAgentCompleted);
        socket.on('agent:failed', handleAgentFailed);

        return () => {
            console.log('[Agent] Cleaning up event listeners');
            // Cleanup listeners
            socket.off('agent:started', handleAgentStarted);
            socket.off('agent:plan', handleAgentPlan);
            socket.off('agent:reasoning', handleAgentReasoning);
            socket.off('agent:step', handleAgentStep);
            socket.off('agent:tool_call', handleToolCall);
            socket.off('agent:tool_result', handleToolResult);
            socket.off('response:chunk', handleResponseChunk);
            socket.off('agent:completed', handleAgentCompleted);
            socket.off('agent:failed', handleAgentFailed);
        };
    }, [socket, onMessageUpdate]);

    /**
     * Send agent message
     * Invokes agent via Socket.IO and returns current message ref
     * @param {string} userMessage - User's message content
     * @param {string} agentType - Agent to invoke (default: 'Router')
     * @param {Array} messages - Conversation history
     * @param {Object} context - Additional domain context
     */
    const sendAgentMessage = useCallback((userMessage, agentType = 'Router', messages = [], context = {}) => {
        if (!socket) {
            console.error('[Agent] Socket not available');
            return null;
        }

        // Reset state to idle before invoking
        currentMessageRef.current = null;
        const idleState = {
            status: 'idle',
            agentName: null,
            timestamp: null,
            plan: null,
            steps: [],
            toolCalls: [],
            observations: []
        };
        logAgentState(currentAgentState, idleState, 'SEND_AGENT_MESSAGE (Reset)', { userMessage, agentType });
        setCurrentAgentState(idleState);

        // Emit agent invocation with explicit messages parameter
        socket.emit('agent:invoke', {
            agentType,
            userMessage,
            sessionId,
            messages,
            context
        });

        return currentMessageRef;
    }, [socket, sessionId]);

    /**
     * Get current accumulated message
     */
    const getCurrentMessage = useCallback(() => {
        return currentMessageRef.current;
    }, []);

    return {
        sendAgentMessage,
        getCurrentMessage,
        currentAgentState,
        isStreaming
    };
}
