import {
    Box, Typography, Paper
} from '@mui/material';

//app imports
import Iconify from '@/app/_components/utils/Iconify';

function ChatMessageAssistantTyping() {
    return (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
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
            <Box sx={{ flex: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="body2" color="textSecondary">
                    Thinking
                </Typography>
                <Box 
                    sx={{ 
                        display: 'flex', 
                        gap: '4px',
                        '& > span': {
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            backgroundColor: 'text.secondary',
                            opacity: 0.4,
                            animation: 'typingDot 1.4s infinite ease-in-out',
                        },
                        '& > span:nth-of-type(1)': {
                            animationDelay: '0s',
                        },
                        '& > span:nth-of-type(2)': {
                            animationDelay: '0.2s',
                        },
                        '& > span:nth-of-type(3)': {
                            animationDelay: '0.4s',
                        },
                        '@keyframes typingDot': {
                            '0%, 60%, 100%': {
                                opacity: 0.4,
                                transform: 'translateY(0)',
                            },
                            '30%': {
                                opacity: 1,
                                transform: 'translateY(-6px)',
                            },
                        },
                    }}
                >
                    <span />
                    <span />
                    <span />
                </Box>
            </Box>
        </Box>
    );
}

export default ChatMessageAssistantTyping;
