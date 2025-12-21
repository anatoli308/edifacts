"use client";

import {
    Container, Box, Typography, TextField, Badge,
    Button, Autocomplete, Accordion, AccordionSummary,
    AccordionDetails, Alert, CircularProgress, Chip, Tooltip,
    Paper, IconButton, InputAdornment, Tabs, Tab
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Dropzone from 'dropzone';

//app imports
import { useUser } from '@/app/_contexts/UserContext';
import { useSocket } from '@/app/_contexts/SocketContext';


function AnalysisChatPage(props) {

    return (
        <Container maxWidth="xxl">
            <Accordion
                expanded={expandedAccordion === 'results'}
                onChange={handleAccordionChange('results')}
            >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                        <Typography variant="h6">🤖 AI Assistant</Typography>
                        <Tooltip title="Settings">
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    router.push('?tab=settings', { scroll: false });
                                }}
                                sx={{ ml: 'auto' }}
                            >
                                <SettingsIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </AccordionSummary>
                <AccordionDetails>
                    <Box sx={{ width: '100%' }}>
                        {/* File Info */}
                        {visualizationData && (
                            <Paper sx={{ p: 2, mb: 2, backgroundColor: 'background.default' }}>
                                <Typography variant="body2" color="textSecondary">
                                    📄 File: <strong>{visualizationData.file?.name}</strong> • {visualizationData.file?.size} bytes
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    📋 Message Type: <strong>{visualizationData.detected?.messageType || 'Unknown'}</strong>
                                </Typography>
                                {visualizationData.subset && (
                                    <Typography variant="body2" color="textSecondary">
                                        🔖 Subset: <strong>{visualizationData.subset?.label}</strong>
                                    </Typography>
                                )}
                            </Paper>
                        )}

                        {/* Chat Messages */}
                        <Paper
                            sx={{
                                p: 2,
                                height: '500px',
                                overflowY: 'auto',
                                backgroundColor: 'background.paper',
                                mb: 2,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2
                            }}
                        >
                            {messages.map((message, index) => (
                                <Box
                                    key={index}
                                    sx={{
                                        display: 'flex',
                                        gap: 1.5,
                                        alignItems: 'flex-start',
                                        flexDirection: message.role === 'user' ? 'row-reverse' : 'row'
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: '50%',
                                            backgroundColor: message.role === 'user' ? 'primary.main' : 'secondary.main',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}
                                    >
                                        {message.role === 'user' ? (
                                            <PersonIcon sx={{ color: 'white', fontSize: 20 }} />
                                        ) : (
                                            <SmartToyIcon sx={{ color: 'white', fontSize: 20 }} />
                                        )}
                                    </Box>
                                    <Paper
                                        sx={{
                                            p: 2,
                                            maxWidth: '70%',
                                            backgroundColor: message.role === 'user'
                                                ? 'primary.main'
                                                : 'background.default',
                                            color: message.role === 'user' ? 'white' : 'text.primary'
                                        }}
                                    >
                                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                            {message.content}
                                        </Typography>
                                    </Paper>
                                </Box>
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
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <SmartToyIcon sx={{ color: 'white', fontSize: 20 }} />
                                    </Box>
                                    <Paper sx={{ p: 2, backgroundColor: 'background.default' }}>
                                        <Typography variant="body2" color="textSecondary">
                                            Typing...
                                        </Typography>
                                    </Paper>
                                </Box>
                            )}

                            <div ref={messagesEndRef} />
                        </Paper>

                        {/* Input Field */}
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
                                            <SendIcon />
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                        />
                    </Box>
                </AccordionDetails>
            </Accordion>
        </Container>
    );
}

export default AnalysisChatPage;