/**
 * Custom Hook: useAgentStreaming
 * Handles real-time agent execution streaming via Socket.IO
 * 
 * Features:
 * - Listens to agent lifecycle events (started, plan, step, tool_call, etc)
 * - Accumulates streaming response chunks
 * - Updates message state in real-time
 * - Error handling and recovery
 * 
 * @param {string} sessionId - Current chat session ID
 * @returns {Object} - { sendAgentMessage, getCurrentMessage, currentAgentState, isStreaming }
 */

import { useEffect, useRef, useState, useCallback } from 'react';

import { useSocket } from '@/app/_contexts/SocketContext';

export function useAgentStreaming(sessionId) {
    const { socket } = useSocket();
    const [currentAgentState, setCurrentAgentState] = useState(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const currentMessageRef = useRef(null);

    useEffect(() => {
        if (!socket) return;

        // Agent Started
        const handleAgentStarted = (data) => {
            console.log('[Agent] Started:', data);
            setIsStreaming(true);
            setCurrentAgentState({
                agentName: data.agentName,
                status: 'started',
                timestamp: data.timestamp,
                plan: null,
                steps: [],
                toolCalls: [],
                observations: []
            });

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
        };

        // Agent Plan (HTN Task Tree)
        const handleAgentPlan = (data) => {
            console.log('[Agent] Plan:', data);
            setCurrentAgentState(prev => ({
                ...prev,
                plan: data.taskTree,
                tasks: data.tasks
            }));

            if (currentMessageRef.current) {
                currentMessageRef.current.content.reasoning = 'Planning task execution...';
            }
        };

        // Agent Step
        const handleAgentStep = (data) => {
            console.log('[Agent] Step:', data);
            setCurrentAgentState(prev => ({
                ...prev,
                steps: [...(prev?.steps || []), data]
            }));

            if (currentMessageRef.current) {
                currentMessageRef.current.content.steps.push(data.stepName);
            }
        };

        // Tool Call
        const handleToolCall = (data) => {
            console.log('[Agent] Tool Call:', data);
            setCurrentAgentState(prev => ({
                ...prev,
                toolCalls: [...(prev?.toolCalls || []), { ...data, status: 'calling' }]
            }));
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
                return { ...prev, toolCalls: updatedToolCalls };
            });

            if (currentMessageRef.current) {
                currentMessageRef.current.content.toolCalls.push({
                    name: data.tool,
                    result: typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2)
                });
            }
        };

        // Response Chunk (LLM Streaming)
        const handleResponseChunk = (data) => {
            if (currentMessageRef.current) {
                currentMessageRef.current.content.text += data.content;
            }
        };

        // Agent Completed
        const handleAgentCompleted = (data) => {
            console.log('[Agent] Completed:', data);
            setIsStreaming(false);
            setCurrentAgentState(prev => ({ ...prev, status: 'completed', result: data.result }));

            if (currentMessageRef.current) {
                currentMessageRef.current.content.status = 'completed';
            }
        };

        // Agent Failed
        const handleAgentFailed = (data) => {
            console.error('[Agent] Failed:', data);
            setIsStreaming(false);
            setCurrentAgentState(prev => ({ ...prev, status: 'failed', error: data.error }));

            if (currentMessageRef.current) {
                currentMessageRef.current.content.status = 'failed';
                currentMessageRef.current.content.text = `Error: ${data.error}`;
            }
        };

        // Register event listeners
        socket.on('agent:started', handleAgentStarted);
        socket.on('agent:plan', handleAgentPlan);
        socket.on('agent:step', handleAgentStep);
        socket.on('agent:tool_call', handleToolCall);
        socket.on('agent:tool_result', handleToolResult);
        socket.on('response:chunk', handleResponseChunk);
        socket.on('agent:completed', handleAgentCompleted);
        socket.on('agent:failed', handleAgentFailed);

        return () => {
            // Cleanup listeners
            socket.off('agent:started', handleAgentStarted);
            socket.off('agent:plan', handleAgentPlan);
            socket.off('agent:step', handleAgentStep);
            socket.off('agent:tool_call', handleToolCall);
            socket.off('agent:tool_result', handleToolResult);
            socket.off('response:chunk', handleResponseChunk);
            socket.off('agent:completed', handleAgentCompleted);
            socket.off('agent:failed', handleAgentFailed);
        };
    }, [socket]);

    /**
     * Send agent message
     * Invokes agent via Socket.IO and returns current message ref
     */
    const sendAgentMessage = useCallback((userMessage, agentType = 'Router', context = {}) => {
        if (!socket) {
            console.error('[Agent] Socket not available');
            return null;
        }

        // Reset state
        currentMessageRef.current = null;
        setCurrentAgentState(null);

        // Emit agent invocation
        socket.emit('agent:invoke', {
            agentType,
            userMessage,
            sessionId,
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
