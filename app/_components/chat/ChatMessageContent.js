import {
    Box,
    Button,
    Typography,
    Tooltip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Link
} from '@mui/material';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

//app imports
import Iconify from '@/app/_components/utils/Iconify';

const ICON_SIZE = 16;
const ICON_MIN_WIDTH = 20;
const ICON_WIDTH = 32;

/**
 * Custom code block with syntax highlighting and copy button
 * @private
 */
function _CodeBlock({ children, className, ...props }) {
    const [copied, setCopied] = React.useState(false);
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    const codeString = String(children).replace(/\n$/, '');

    const handleCopyCode = () => {
        navigator.clipboard.writeText(codeString);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
    };

    // Inline code
    if (!match) {
        return (
            <Box
                component="code"
                sx={{
                    px: 0.6,
                    py: 0.2,
                    borderRadius: 0.5,
                    fontSize: '0.85em',
                    fontFamily: 'monospace',
                    bgcolor: 'action.hover',
                    color: 'secondary.main',
                    wordBreak: 'break-word',
                }}
                {...props}
            >
                {children}
            </Box>
        );
    }

    // Code block with syntax highlighting
    return (
        <Box sx={{ position: 'relative', my: 1.5 }}>
            {/* Header bar */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    bgcolor: 'grey.900',
                    color: 'grey.400',
                    px: 1.5,
                    py: 0.5,
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 8,
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                }}
            >
                <span>{language}</span>
                <Tooltip title={copied ? 'Copied!' : 'Copy code'}>
                    <Button
                        size="small"
                        onClick={handleCopyCode}
                        sx={{
                            minWidth: 'auto',
                            px: 1,
                            py: 0.25,
                            color: 'grey.400',
                            '&:hover': { color: 'grey.100' },
                            textTransform: 'none',
                            fontSize: '0.75rem',
                        }}
                        startIcon={
                            <Iconify
                                icon={copied ? 'ci:check' : 'ci:copy'}
                                sx={{ fontSize: 14, color: copied ? 'success.main' : 'inherit' }}
                            />
                        }
                    >
                        {copied ? 'Copied!' : 'Copy'}
                    </Button>
                </Tooltip>
            </Box>
            <SyntaxHighlighter
                style={oneDark}
                language={language}
                PreTag="div"
                customStyle={{
                    margin: 0,
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                    borderBottomLeftRadius: 8,
                    borderBottomRightRadius: 8,
                    fontSize: '0.85rem',
                }}
            >
                {codeString}
            </SyntaxHighlighter>
        </Box>
    );
}

/**
 * Markdown components mapped to MUI
 * @private
 */
const _markdownComponents = {
    // Code: inline + block with syntax highlighting
    code: _CodeBlock,

    // Tables → MUI Table components
    table: ({ children }) => (
        <TableContainer component={Paper} variant="outlined" sx={{ my: 1.5, overflow: 'auto' }}>
            <Table size="small">{children}</Table>
        </TableContainer>
    ),
    thead: ({ children }) => <TableHead>{children}</TableHead>,
    tbody: ({ children }) => <TableBody>{children}</TableBody>,
    tr: ({ children }) => <TableRow>{children}</TableRow>,
    th: ({ children }) => (
        <TableCell
            sx={{
                fontWeight: 'bold',
                bgcolor: 'action.hover',
                whiteSpace: 'nowrap',
                borderBottom: 2,
                borderColor: 'divider',
            }}
        >
            {children}
        </TableCell>
    ),
    td: ({ children }) => (
        <TableCell sx={{ borderColor: 'divider' }}>
            {children}
        </TableCell>
    ),

    // Typography
    p: ({ children }) => (
        <Typography variant="body1" sx={{ mb: 1, lineHeight: 1.7 }}>
            {children}
        </Typography>
    ),
    h1: ({ children }) => <Typography variant="h5" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>{children}</Typography>,
    h2: ({ children }) => <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>{children}</Typography>,
    h3: ({ children }) => <Typography variant="subtitle1" sx={{ mt: 1.5, mb: 0.5, fontWeight: 'bold' }}>{children}</Typography>,

    // Links
    a: ({ href, children }) => (
        <Link href={href} target="_blank" rel="noopener noreferrer" underline="hover">
            {children}
        </Link>
    ),

    // Lists
    ul: ({ children }) => (
        <Box component="ul" sx={{ pl: 2.5, mb: 1 }}>{children}</Box>
    ),
    ol: ({ children }) => (
        <Box component="ol" sx={{ pl: 2.5, mb: 1 }}>{children}</Box>
    ),
    li: ({ children }) => (
        <Typography component="li" variant="body1" sx={{ mb: 0.3, lineHeight: 1.7 }}>
            {children}
        </Typography>
    ),

    // Blockquote
    blockquote: ({ children }) => (
        <Box
            sx={{
                borderLeft: 3,
                borderColor: 'primary.main',
                pl: 2,
                py: 0.5,
                my: 1,
                bgcolor: 'action.hover',
                borderRadius: 1,
            }}
        >
            {children}
        </Box>
    ),

    // Horizontal rule
    hr: () => <Box component="hr" sx={{ border: 'none', borderTop: 1, borderColor: 'divider', my: 2 }} />,
};

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
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={_markdownComponents}
            >
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