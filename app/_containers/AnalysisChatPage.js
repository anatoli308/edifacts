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

    // Callback: Handle message updates from streaming
    const handleMessageUpdate = useCallback((message) => {
        setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
                // Update existing assistant message
                return [...prev.slice(0, -1), message];
            } else {
                // Add new assistant message
                return [...prev, message];
            }
        });
    }, []);

    // Agent streaming hook with callback
    const { sendAgentMessage, getCurrentMessage, currentAgentState, isStreaming } = useAgentStreaming(sessionId, handleMessageUpdate);

    // Auto-scroll to latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Update typing state based on streaming
    useEffect(() => {
        setIsAssistantTyping(isStreaming);
    }, [isStreaming]);

    const handleSendMessage = (userMessageContent) => {
        const newUserMessage = {
            role: 'user',
            content: userMessageContent,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, newUserMessage]);

        sendAgentMessage(userMessageContent, 'Router', {
            latestMessages: [
                ...messages.slice(-2), // Letzte 2 Turns/messages
                newUserMessage
            ],
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