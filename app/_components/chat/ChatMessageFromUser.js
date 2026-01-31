import {
    Box,
    Paper,
    Typography
} from '@mui/material';

function ChatMessageFromUser({ content }) {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Paper
                sx={{
                    p: 1,
                    backgroundColor: 'primary.main',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    maxWidth:'90%'
                }}
            >
                <Typography variant="body1" color='common.white'>
                    {content}
                </Typography>
            </Paper>
        </Box>
    );
}

export default ChatMessageFromUser;
