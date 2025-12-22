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
    );
}

export default ChatMessageUserInput;
