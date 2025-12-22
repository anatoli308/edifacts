import {
    Box, Typography, Paper
} from '@mui/material';

function ChatMessageFromUser({ content }) {
    return (
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
                    {content}
                </Typography>
            </Paper>
        </Box>
    );
}

export default ChatMessageFromUser;
