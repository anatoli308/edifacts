import {
    Box, Typography, Paper
} from '@mui/material';

//app imports
import Iconify from '@/app/_components/utils/Iconify';

function ChatMessageAssistantTyping() {
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
            <Paper sx={{ p: 2, backgroundColor: 'background.default' }}>
                <Typography variant="body2" color="textSecondary">
                    Typing...
                </Typography>
            </Paper>
        </Box>
    );
}

export default ChatMessageAssistantTyping;
