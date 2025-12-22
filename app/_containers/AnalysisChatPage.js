"use client";

import {
    Box,
    Container,
    IconButton, InputAdornment,
    Link as MuiLink,
    Paper,
    TextField,
    Typography
} from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

//app imports
import ChatMessage from '@/app/_components/ChatMessage';
import Iconify from '@/app/_components/Iconify';

function AnalysisChatPage(props) {

    const router = useRouter();
    const [messages, setMessages] = useState([]);
    const [userMessage, setUserMessage] = useState('');
    const [isAssistantTyping, setIsAssistantTyping] = useState(false);
    const messagesEndRef = useRef(null);

    // Auto-scroll to latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!userMessage.trim()) return;

        const newUserMessage = {
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, newUserMessage]);
        setUserMessage('');
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
                    text: `I received your message: "${userMessage}". This is a placeholder response. In production, I'll analyze your EDIFACT data and provide detailed answers.`,
                    status: 'completed'
                },
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, assistantMessage]);
            setIsAssistantTyping(false);
        }, 1500);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <Container maxWidth="md" disableGutters sx={{ height: "100%", display: 'flex', flexDirection: 'column', p: 0 }}>
            <Box sx={{ p: 0, height: "100%", display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ height: "100%", display: 'flex', flexDirection: 'column', p: 0, overflow: 'hidden' }}>

                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>

                        {props.visualizationData && (
                            <Paper sx={{ p: 2, mb: 2, backgroundColor: 'background.default', flexShrink: 0 }}>
                                <Typography variant="body2" color="textSecondary">
                                    📄 File: <strong>{props.visualizationData.file?.name}</strong> • {props.visualizationData.file?.size} bytes
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    📋 Message Type: <strong>{props.visualizationData.detected?.messageType || 'Unknown'}</strong>
                                </Typography>
                                {props.visualizationData.subset && (
                                    <Typography variant="body2" color="textSecondary">
                                        🔖 Subset: <strong>{props.visualizationData.subset?.label}</strong>
                                    </Typography>
                                )}
                            </Paper>
                        )}

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
                                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                                    <Box
                                        sx={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: '50%',
                                            backgroundColor: 'secondary.main',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}
                                    >
                                        <Iconify icon="mdi:smart-toy" sx={{ color: 'white', fontSize: 20 }} />
                                    </Box>
                                    <Paper sx={{ p: 2, backgroundColor: 'background.default' }}>
                                        <Typography variant="body2" color="textSecondary">
                                            Typing...
                                        </Typography>
                                    </Paper>
                                </Box>
                            )}

                            <div ref={messagesEndRef} />
                        </Box>

                        {/* Input Field */}
                        <Box sx={{ flexShrink: 0 }}>
                            <TextField
                                fullWidth
                                multiline
                                maxRows={4}
                                value={userMessage}
                                onChange={(e) => setUserMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Ask me anything about your EDIFACT data..."
                                variant="outlined"
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                color="primary"
                                                onClick={handleSendMessage}
                                                disabled={!userMessage.trim() || isAssistantTyping}
                                            >
                                                <Iconify icon="mdi:send" />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />
                            <Typography
                                variant="caption"
                                color="textSecondary"
                                sx={{
                                    display: 'block',
                                    mt: 1,
                                    textAlign: 'center',
                                    fontSize: '0.75rem'
                                }}
                            >
                                EDIFACTS Assistant can make mistakes. Please verify important information. See <MuiLink href="/cookie-preferences" as={Link} underline="always" color='inherit'>cookie preferences</MuiLink>.
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Container>
    );
}

export default AnalysisChatPage;