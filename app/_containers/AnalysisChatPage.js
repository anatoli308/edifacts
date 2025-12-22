"use client";

import {
    Box,
    Container
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';

//app imports
import ChatMessage from '@/app/_components/chat/ChatMessage';
import ChatMessageAssistantTyping from '@/app/_components/chat/ChatMessageAssistantTyping';
import ChatMessageUserInput from '@/app/_components/chat/ChatMessageUserInput';

function AnalysisChatPage(props) {

    const [messages, setMessages] = useState([]);
    const [isAssistantTyping, setIsAssistantTyping] = useState(false);
    const messagesEndRef = useRef(null);

    // Auto-scroll to latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (userMessageContent) => {
        const newUserMessage = {
            role: 'user',
            content: userMessageContent,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, newUserMessage]);
        setIsAssistantTyping(true);

        // Simulate AI response (replace with actual API call later)
        setTimeout(() => {
            const assistantMessage = {
                role: 'assistant',
                content: {
                    reasoning: 'Let me analyze your EDIFACT data and provide a comprehensive response.',
                    steps: [
                        'Parsing the EDIFACT message structure',
                        'Identifying message segments',
                        'Extracting business data',
                        'Validating against standards'
                    ],
                    toolCalls: [
                        { name: 'parse_edifact', result: 'Successfully parsed 15 segments' },
                        { name: 'validate_message', result: 'Message type: ORDERS' }
                    ],
                    text: `I received your message: "${userMessageContent}". This is a placeholder response. In production, I'll analyze your EDIFACT data and provide detailed answers.`,
                    status: 'completed'
                },
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, assistantMessage]);
            setIsAssistantTyping(false);
        }, 1500);
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