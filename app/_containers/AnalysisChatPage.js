"use client";

import {
    Box,
    Container,
    Toolbar,
    Fab,
    Fade,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';

//app imports
import ChatMessage from '@/app/_components/chat/ChatMessage';
import ChatMessageAssistantTyping from '@/app/_components/chat/ChatMessageAssistantTyping';
import ChatMessageUserInput from '@/app/_components/chat/ChatMessageUserInput';
import Iconify from '@/app/_components/utils/Iconify';
import { useAgentStreaming } from '@/app/_hooks/useAgentStreaming';
import { useProtectedRoute } from '@/app/_hooks/useProtectedRoute';
import { useChatAuthenticatedRoute } from '@/app/_hooks/useChatAuthenticatedRoute';

function AnalysisChatPage({ analysisChat }) {
    useProtectedRoute('/'); // Redirect to start if not authenticated
    //redirect if not authorized to access this chat
    const { isAuthorized, loading } = useChatAuthenticatedRoute(analysisChat);

    const sessionId = analysisChat?._id || 'invalid-session'; //TODO: remove demo-session fallback

    const [messages, setMessages] = useState([]);
    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null);

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

    // Scroll to bottom function
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = (userMessageContent) => {
        const newUserMessage = {
            role: 'user',
            content: userMessageContent,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, newUserMessage]);

        // Pass messages as explicit parameter
        const conversationHistory = [
            ...messages,//.slice(-10),
            newUserMessage
        ];

        sendAgentMessage(
            userMessageContent,
            conversationHistory,
            { sessionId } // Context now only contains domain data
        );
    };

    return (
        <Box sx={{ height: '100vh', overflow: 'auto', backgroundColor: 'background.default', display: 'flex', flexDirection: 'column' }}>
            {/* Outer XXL Container: Scrollbar, fills viewport */}
            <Container maxWidth="xl" disableGutters sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 0 }}>
                {/* Inner centered Container */}
                <Container maxWidth="md" disableGutters sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, py: 0, position: 'relative' }}>
                    {/* Main Chat Area: Flex column, fills inner container */}
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        {/* Chat Messages: Scrollable */}
                        <Box
                            ref={scrollContainerRef}
                            sx={{
                                flex: 1,
                                overflowY: 'auto',
                                backgroundColor: 'background.paper',
                                px: 1,
                                py: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1,
                                minHeight: 0,
                            }}
                        >
                            {messages.map((message, index) => (
                                <ChatMessage key={index} message={message} />
                            ))}

                            {isStreaming && (
                                <ChatMessageAssistantTyping />
                            )}

                            <Toolbar ref={messagesEndRef} />
                        </Box>

                        {/* Sticky User Input */}
                        <Box
                            sx={{
                                position: 'sticky',
                                bottom: 0,
                                zIndex: 10,
                                backgroundColor: 'background.paper',
                                boxShadow: '0 -2px 8px rgba(0,0,0,0.04)',
                                py: 1,
                            }}
                        >
                            <ChatMessageUserInput
                                onSendMessage={handleSendMessage}
                                isAssistantTyping={isStreaming}
                            />
                        </Box>
                    </Box>


                </Container>
                {/* Scroll to Bottom Button */}
                <Fade in={true}>
                    <Fab
                        color="primary"
                        size="medium"
                        aria-label="scroll to bottom"
                        onClick={scrollToBottom}
                        sx={{
                            position: 'absolute',
                            bottom: 90,
                            right: 24,
                            zIndex: 2001,
                            boxShadow: 3,
                        }}
                    >
                        <Iconify icon="mdi:arrow-down" width={24} />
                    </Fab>
                </Fade>
            </Container>
        </Box>
    );
}

export default AnalysisChatPage;