"use client";

import {
    Box,
    Container
} from '@mui/material';
import { useEffect, useRef, useState, useCallback } from 'react';

//app imports
import ChatMessage from '@/app/_components/chat/ChatMessage';
import ChatMessageAssistantTyping from '@/app/_components/chat/ChatMessageAssistantTyping';
import ChatMessageUserInput from '@/app/_components/chat/ChatMessageUserInput';
import { useAgentStreaming } from '@/app/_hooks/useAgentStreaming';

function AnalysisChatPage(props) {
    const sessionId = props.sessionId || 'demo-session'; //TODO: remove demo-session fallback

    const [messages, setMessages] = useState([]);
    const [isAssistantTyping, setIsAssistantTyping] = useState(false);
    const messagesEndRef = useRef(null);

    // Agent streaming hook (socket is now used internally)
    const { sendAgentMessage, getCurrentMessage, currentAgentState, isStreaming } = useAgentStreaming(sessionId);

    // Auto-scroll to latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Update messages when agent streaming is active
    useEffect(() => {
        if (isStreaming) {
            setIsAssistantTyping(true);

            // Update message in real-time
            const interval = setInterval(() => {
                const currentMsg = getCurrentMessage();
                if (currentMsg) {
                    setMessages(prev => {
                        const lastMsg = prev[prev.length - 1];
                        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content?.status === 'streaming') {
                            // Update existing streaming message
                            return [...prev.slice(0, -1), currentMsg];
                        } else {
                            // Add new streaming message
                            return [...prev, currentMsg];
                        }
                    });
                }
            }, 100); // Update every 100ms for smooth streaming

            return () => clearInterval(interval);
        } else {
            setIsAssistantTyping(false);
        }
    }, [isStreaming, getCurrentMessage]);

    const handleSendMessage = (userMessageContent) => {
        const newUserMessage = {
            role: 'user',
            content: userMessageContent,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, newUserMessage]);

        // Invoke agent via Socket.IO (socket check is handled in hook)
        sendAgentMessage(userMessageContent, 'Router', {
            // Add EDIFACT context here
            edifactData: null, // TODO: Pass parsed EDIFACT data
            sessionId
        });
    };

    return (
        <Container maxWidth="md" disableGutters sx={{ height: "100%", display: 'flex', flexDirection: 'column', p: 0 }}>
            <Box sx={{ p: 0, height: "100%", display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ height: "100%", display: 'flex', flexDirection: 'column', p: 0, overflow: 'hidden' }}>

                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>

                        {/* Chat Messages */}
                        <Box
                            sx={{
                                p: 2,
                                flex: 1,
                                overflowY: 'auto',
                                backgroundColor: 'background.paper',
                                mb: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                                minHeight: 0
                            }}
                        >
                            {messages.map((message, index) => (
                                <ChatMessage key={index} message={message} />
                            ))}

                            {isAssistantTyping && (
                                <ChatMessageAssistantTyping />
                            )}

                            <div ref={messagesEndRef} />
                        </Box>

                        {/* Input Field */}
                        <ChatMessageUserInput
                            onSendMessage={handleSendMessage}
                            isAssistantTyping={isAssistantTyping}
                        />
                    </Box>
                </Box>
            </Box>
        </Container>
    );
}

export default AnalysisChatPage;