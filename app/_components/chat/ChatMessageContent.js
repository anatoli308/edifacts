import {
    Box,
    Paper,
    Typography,
    alpha
} from '@mui/material';
import ReactMarkdown from 'react-markdown';

//app imports
import Iconify from '@/app/_components/utils/Iconify';

function ChatMessageContent({ content, status }) {
    return (
        <>
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
            {status === 'completed' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                    <Iconify icon="mdi:check-circle" sx={{ fontSize: 14, color: 'success.main' }} />
                    <Typography variant="caption" sx={{ color: 'success.main' }}>
                        Completed
                    </Typography>
                </Box>
            )}
        </>
    );
}

export default ChatMessageContent;
