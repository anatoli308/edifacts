import {
    Box, Typography, Paper
} from '@mui/material';

//app imports
import Iconify from '@/app/_components/utils/Iconify';
import ChatMessageReasoning from '@/app/_components/chat/ChatMessageReasoning';
import ChatMessageSteps from '@/app/_components/chat/ChatMessageSteps';
import ChatMessageToolCalls from '@/app/_components/chat/ChatMessageToolCalls';

const display = true; //TODO: for now we not use/display reasoning, steps, tool calls in the UI

function ChatMessageAssistantTyping({ content, currentAgentState }) {
    // Extract reasoning content from currentAgentState if available
    const reasoningText = currentAgentState?.reasoning || '';
    const hasReasoning = reasoningText.length > 0;

    return (
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
                <Iconify icon="material-symbols-light:smart-toy-outline" sx={{ color: 'white', fontSize: 20 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
                <Paper sx={{ p: 2, backgroundColor: 'background.default' }}>
                    {hasReasoning ? (
                        <>
                            <Typography variant="caption" color="textSecondary" sx={{ fontStyle: 'italic', mb: 1, display: 'block' }}>
                                Thinking...
                            </Typography>
                            <Typography 
                                variant="body2" 
                                color="text.secondary"
                                sx={{ 
                                    fontFamily: 'monospace',
                                    fontSize: '0.85rem',
                                    whiteSpace: 'pre-wrap',
                                    opacity: 0.7
                                }}
                            >
                                {reasoningText}
                            </Typography>
                        </>
                    ) : (
                        <Typography variant="body2" color="textSecondary">
                            Thinking...
                        </Typography>
                    )}
                </Paper>
                {/* Reasoning Section */}
                {display && content.reasoning && (
                    <ChatMessageReasoning
                        reasoning={content.reasoning}
                    />
                )}

                {/* Steps Section */}
                {display && content.steps && content.steps.length > 0 && (
                    <ChatMessageSteps
                        steps={content.steps}
                    />
                )}

                {/* Tool Calls Section */}
                {display && content.toolCalls && content.toolCalls.length > 0 && (
                    <ChatMessageToolCalls
                        toolCalls={content.toolCalls}
                    />
                )}
            </Box>
        </Box>
    );
}

export default ChatMessageAssistantTyping;
