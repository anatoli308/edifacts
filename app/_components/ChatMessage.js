"use client";

import {
    Box, Typography, Paper, Chip, Accordion, AccordionSummary, AccordionDetails,
    Divider, IconButton, Tooltip, alpha
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import PsychologyIcon from '@mui/icons-material/Psychology';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import CodeIcon from '@mui/icons-material/Code';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

function ChatMessage({ message }) {
    const [expanded, setExpanded] = useState({});

    const handleAccordionChange = (panel) => (event, isExpanded) => {
        setExpanded(prev => ({ ...prev, [panel]: isExpanded }));
    };

    const handleCopyCode = (code) => {
        navigator.clipboard.writeText(code);
    };

    const renderUserMessage = () => (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Paper
                sx={{
                    p: 2,
                    maxWidth: '70%',
                    backgroundColor: 'primary.main',
                    color: 'white'
                }}
            >
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {message.content}
                </Typography>
            </Paper>
        </Box>
    );

    const renderAssistantMessage = () => {
        const content = typeof message.content === 'string'
            ? { text: message.content }
            : message.content;

        return (
            <Box sx={{ mb: 2 }}>
                    {/* Reasoning Section */}
                    {content.reasoning && (
                        <Accordion
                            disableGutters
                            elevation={0}
                            sx={{
                                mb: 1,
                                '&:before': { display: 'none' },
                                backgroundColor: alpha('#9c27b0', 0.05),
                                border: '1px solid',
                                borderColor: alpha('#9c27b0', 0.2)
                            }}
                        >
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                sx={{
                                    minHeight: 40,
                                    '& .MuiAccordionSummary-content': { my: 0.5 }
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <PsychologyIcon sx={{ fontSize: 18, color: '#9c27b0' }} />
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#9c27b0' }}>
                                        Reasoning
                                    </Typography>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
                                <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
                                    {content.reasoning}
                                </Typography>
                            </AccordionDetails>
                        </Accordion>
                    )}

                    {/* Steps Section */}
                    {content.steps && content.steps.length > 0 && (
                        <Accordion
                            disableGutters
                            elevation={0}
                            sx={{
                                mb: 1,
                                '&:before': { display: 'none' },
                                backgroundColor: alpha('#2196f3', 0.05),
                                border: '1px solid',
                                borderColor: alpha('#2196f3', 0.2)
                            }}
                        >
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                sx={{
                                    minHeight: 40,
                                    '& .MuiAccordionSummary-content': { my: 0.5 }
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <FormatListNumberedIcon sx={{ fontSize: 18, color: '#2196f3' }} />
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#2196f3' }}>
                                        Steps ({content.steps.length})
                                    </Typography>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {content.steps.map((step, idx) => (
                                        <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                            <Chip
                                                label={idx + 1}
                                                size="small"
                                                sx={{ minWidth: 24, height: 24, fontSize: '0.75rem' }}
                                            />
                                            <Typography variant="body2" sx={{ flex: 1, color: 'text.secondary' }}>
                                                {step}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            </AccordionDetails>
                        </Accordion>
                    )}

                    {/* Tool Calls Section */}
                    {content.toolCalls && content.toolCalls.length > 0 && (
                        <Accordion
                            disableGutters
                            elevation={0}
                            sx={{
                                mb: 1,
                                '&:before': { display: 'none' },
                                backgroundColor: alpha('#ff9800', 0.05),
                                border: '1px solid',
                                borderColor: alpha('#ff9800', 0.2)
                            }}
                        >
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                sx={{
                                    minHeight: 40,
                                    '& .MuiAccordionSummary-content': { my: 0.5 }
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <BuildIcon sx={{ fontSize: 18, color: '#ff9800' }} />
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#ff9800' }}>
                                        Tool Calls ({content.toolCalls.length})
                                    </Typography>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                    {content.toolCalls.map((tool, idx) => (
                                        <Paper key={idx} sx={{ p: 1.5, backgroundColor: 'background.default' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                <CodeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                                <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                                                    {tool.name}
                                                </Typography>
                                            </Box>
                                            {tool.result && (
                                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                                                    {tool.result}
                                                </Typography>
                                            )}
                                        </Paper>
                                    ))}
                                </Box>
                            </AccordionDetails>
                        </Accordion>
                    )}

                    {/* Main Response */}
                    <Paper
                        sx={{
                            p: 2,
                            backgroundColor: 'background.default',
                            borderRadius: 1
                        }}
                    >
                        <Box sx={{
                            '& p': { mt: 0, mb: 1 },
                            '& p:last-child': { mb: 0 },
                            '& pre': {
                                backgroundColor: alpha('#000', 0.05),
                                p: 1.5,
                                borderRadius: 1,
                                overflow: 'auto',
                                position: 'relative'
                            },
                            '& code': {
                                fontFamily: 'monospace',
                                fontSize: '0.875rem'
                            },
                            '& ul, & ol': { pl: 2, my: 1 },
                            '& li': { mb: 0.5 },
                            '& h1, & h2, & h3, & h4, & h5, & h6': {
                                mt: 2,
                                mb: 1,
                                fontWeight: 600
                            },
                            '& blockquote': {
                                borderLeft: '4px solid',
                                borderColor: 'primary.main',
                                pl: 2,
                                ml: 0,
                                fontStyle: 'italic',
                                color: 'text.secondary'
                            }
                        }}>
                            <ReactMarkdown>{content.text || content}</ReactMarkdown>
                        </Box>
                    </Paper>

                    {/* Status Indicator */}
                    {content.status === 'completed' && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                            <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                            <Typography variant="caption" sx={{ color: 'success.main' }}>
                                Completed
                            </Typography>
                        </Box>
                    )}
            </Box>
        );
    };

    if (message.role === 'user') {
        return renderUserMessage();
    }

    return renderAssistantMessage();
}

export default ChatMessage;
