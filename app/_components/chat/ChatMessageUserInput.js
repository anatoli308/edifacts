import {
    Box,
    IconButton,
    InputAdornment,
    Link as MuiLink,
    TextField,
    Typography
} from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';
import Iconify from '@/app/_components/utils/Iconify';

function ChatMessageUserInput({ onSendMessage, isAssistantTyping }) {
    const [userMessage, setUserMessage] = useState('');

    const handleSendMessage = () => {
        if (!userMessage.trim()) return;
        onSendMessage(userMessage);
        setUserMessage('');
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };
    return (
        <Box sx={{ width: '100%' }}>
            <TextField
                fullWidth
                multiline
                maxRows={6}
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                variant="outlined"
                sx={{
                    backgroundColor: 'background.default',
                    borderRadius: 2,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
                InputProps={{
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton
                                color="primary"
                                onClick={handleSendMessage}
                                disabled={!userMessage.trim() || isAssistantTyping}
                                sx={{
                                    backgroundColor: 'primary.main',
                                    color: 'common.white',
                                    borderRadius: 2,
                                    '&:hover': { backgroundColor: 'primary.dark' },
                                }}
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
                    fontSize: '0.75rem',
                    opacity: 0.7
                }}
            >
                EDIFACTS Assistant can make mistakes. Please verify important information. See <MuiLink href="/cookie-preferences" as={Link} underline="always" color='inherit'>cookie preferences</MuiLink>.
            </Typography>
        </Box>
    );
}

export default ChatMessageUserInput;
