import {
    Box,
    Button,
    Typography,
    Tooltip
} from '@mui/material';
import React from 'react';
import ReactMarkdown from 'react-markdown';

//app imports
import Iconify from '@/app/_components/utils/Iconify';

const ICON_SIZE = 16;
const ICON_MIN_WIDTH = 20;
const ICON_WIDTH = 32;

function ChatMessageContent({ content }) {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(content.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 5000);
    };

    return (
        <>
            {/* Main Response */}
            <ReactMarkdown>
                {content.text}
            </ReactMarkdown>

            {/* Action Bar */}
            {content.status === 'completed' && (
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Tooltip title={copied ? "Copied!" : "Copy"}>
                        <Button sx={{ width: ICON_WIDTH, minWidth: ICON_MIN_WIDTH }} size="small" onClick={handleCopy}>
                            {copied ? (
                                <Iconify icon="ci:check" sx={{ fontSize: ICON_SIZE, color: 'success.main' }} />
                            ) : (
                                <Iconify icon="ci:copy" sx={{ fontSize: ICON_SIZE, color: "text.primary" }} />
                            )}
                        </Button>
                    </Tooltip>
                    <Tooltip title="Good Response">
                        <Button sx={{ width: ICON_WIDTH, minWidth: ICON_MIN_WIDTH }} size="small">
                            <Iconify icon="bi:hand-thumbs-up" sx={{ fontSize: ICON_SIZE, color: "text.primary" }} />
                        </Button>
                    </Tooltip>
                    <Tooltip title="Bad Response">
                        <Button sx={{ width: ICON_WIDTH, minWidth: ICON_MIN_WIDTH }} size="small">
                            <Iconify icon="bi:hand-thumbs-down" sx={{ fontSize: ICON_SIZE, color: "text.primary" }} />
                        </Button>
                    </Tooltip>
                    <Tooltip title="Share Session">
                        <Button sx={{ width: ICON_WIDTH, minWidth: ICON_MIN_WIDTH }} size="small">
                            <Iconify icon="mdi:share-variant" sx={{ fontSize: ICON_SIZE, color: "text.primary" }} />
                        </Button>
                    </Tooltip>
                    <Tooltip title="Try again...">
                        <Button sx={{ width: ICON_WIDTH, minWidth: ICON_MIN_WIDTH }} size="small">
                            <Iconify icon="pajamas:retry" sx={{ fontSize: ICON_SIZE, color: "text.primary" }} />
                        </Button>
                    </Tooltip>
                    <Tooltip title="More actions">
                        <Button sx={{ width: ICON_WIDTH, minWidth: ICON_MIN_WIDTH }} size="small">
                            <Iconify icon="weui:more-filled" sx={{ fontSize: ICON_SIZE, color: "text.primary" }} />
                        </Button>
                    </Tooltip>
                </Box>
            )}

            {/* Status Indicator failed*/}
            {content.status === 'failed' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Iconify icon="mdi:alert-circle" sx={{ fontSize: 14, color: 'error.main' }} />
                    <Typography variant="caption" sx={{ color: 'error.main' }}>
                        {'Failed to get response.'}
                    </Typography>
                </Box>
            )}
        </>
    );
}

export default ChatMessageContent;