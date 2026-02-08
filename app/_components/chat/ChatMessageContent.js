import {
    Box,
    Button,
    Chip,
    LinearProgress,
    Stack,
    Typography,
    Tooltip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Link,
    Alert,
} from '@mui/material';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import 'katex/dist/katex.min.css';

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

    // Intercept code blocks that contain only [[...]] patterns — render as components
    if (!language || language === 'text' || language === 'plaintext') {
        const lines = codeString.split('\n').map(l => l.trim()).filter(Boolean);
        const allPatterns = lines.length > 0 && lines.every(line => /^\[\[.+\]\]$/.test(line));
        if (allPatterns) {
            const parsed = lines.map((line) => _parseSinglePattern(line)).filter(Boolean);
            if (parsed.length === lines.length) {
                return (
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', my: 0.5, gap: 0.5 }}>
                        {parsed.map((el, index) => <React.Fragment key={index}>{el}</React.Fragment>)}
                    </Stack>
                );
            }
        }
        // Also handle lines with multiple [[...]] patterns separated by spaces
        const allLinesHavePatterns = lines.length > 0 && lines.every(line => line.includes('[['));
        if (allLinesHavePatterns) {
            const allParts = [];
            let allValid = true;
            for (const line of lines) {
                const parts = line.split(/(\[\[[^\]]+\]\])/g).filter(Boolean);
                for (const part of parts) {
                    if (/^\[\[.+\]\]$/.test(part)) {
                        const component = _parseSinglePattern(part);
                        if (component) { allParts.push(component); continue; }
                    }
                    if (part.trim()) { allValid = false; break; }
                }
                if (!allValid) break;
            }
            if (allValid && allParts.length > 0) {
                return (
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', my: 0.5, gap: 0.5 }}>
                        {allParts.map((el, index) => <React.Fragment key={index}>{el}</React.Fragment>)}
                    </Stack>
                );
            }
        }
    }

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
 * Color map for badge/status components
 * @private
 */
const _COLOR_MAP = {
    success: 'success', ok: 'success', pass: 'success', valid: 'success',
    error: 'error', fail: 'error', invalid: 'error', critical: 'error',
    warning: 'warning', warn: 'warning', caution: 'warning',
    info: 'info', note: 'info', default: 'default',
    primary: 'primary', secondary: 'secondary',
};

/**
 * Resolve MUI color from string
 * @private
 */
function _resolveColor(color) {
    return _COLOR_MAP[(color || 'default').toLowerCase()] || 'default';
}

/**
 * Recursively extract plain text from React children
 * @private
 */
function _extractText(children) {
    if (typeof children === 'string') return children;
    if (typeof children === 'number') return String(children);
    if (!children) return '';
    if (Array.isArray(children)) return children.map(_extractText).join('');
    if (children.props?.children) return _extractText(children.props.children);
    return '';
}

/**
 * Parse a single [[type:...]] pattern and return a React element
 * @private
 */
function _parseSinglePattern(raw) {
    const trimmed = raw.trim();

    // [[badge:label:color]] — last colon-segment is the color
    const badgeMatch = trimmed.match(/^\[\[badge:(.+)\]\]$/);
    if (badgeMatch) {
        const parts = badgeMatch[1].split(':');
        const color = parts.length > 1 ? parts.pop() : 'default';
        const label = parts.join(':');
        return (
            <Chip
                label={label}
                color={_resolveColor(color)}
                size="small"
                sx={{ fontWeight: 600, mr: 0.5 }}
            />
        );
    }

    // [[progress:value]] or [[progress:value:color]]
    const progressMatch = trimmed.match(/^\[\[progress:(\d+)(?::(.+?))?\]\]$/);
    if (progressMatch) {
        const value = Math.min(100, Math.max(0, parseInt(progressMatch[1], 10)));
        const color = _resolveColor(progressMatch[2]);
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 1 }}>
                <LinearProgress
                    variant="determinate"
                    value={value}
                    color={color === 'default' ? 'primary' : color}
                    sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                />
                <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 40 }}>
                    {value}%
                </Typography>
            </Box>
        );
    }

    // [[metric:value|label]] or [[metric:value|label:color]]
    const metricMatch = trimmed.match(/^\[\[metric:(.+?)\|(.+?)(?::(.+?))?\]\]$/);
    if (metricMatch) {
        const color = _resolveColor(metricMatch[3]);
        const colorValue = color === 'default' ? 'text.primary' : `${color}.main`;
        return (
            <Paper
                variant="outlined"
                sx={{
                    display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                    px: 3, py: 1.5, borderRadius: 2, minWidth: 100,
                }}
            >
                <Typography variant="h5" sx={{ fontWeight: 700, color: colorValue }}>
                    {metricMatch[1]}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.25 }}>
                    {metricMatch[2]}
                </Typography>
            </Paper>
        );
    }

    // [[status:type|message]]
    const statusMatch = trimmed.match(/^\[\[status:(.+?)\|(.+)\]\]$/);
    if (statusMatch) {
        const severity = _resolveColor(statusMatch[1]);
        const validSeverities = ['success', 'error', 'warning', 'info'];
        return (
            <Alert
                severity={validSeverities.includes(severity) ? severity : 'info'}
                variant="outlined"
                sx={{ my: 1 }}
            >
                {statusMatch[2]}
            </Alert>
        );
    }

    return null;
}

/**
 * Parse custom component patterns from paragraph children
 * Handles single patterns, multiple patterns, and mixed text + patterns inline
 * @private
 */
function _CustomComponent({ children }) {
    const text = _extractText(children).trim();
    if (!text.includes('[[')) return null;

    // Single pattern on its own line
    const singleResult = _parseSinglePattern(text);
    if (singleResult) return singleResult;

    // Multiple patterns on separate lines (LLM may group them in one paragraph)
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed = lines.map((line) => _parseSinglePattern(line) || null);

    // All lines are valid patterns — render as row of components
    if (parsed.every(Boolean)) {
        return (
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', my: 0.5, gap: 0.5 }}>
                {parsed.map((el, index) => <React.Fragment key={index}>{el}</React.Fragment>)}
            </Stack>
        );
    }

    // Mixed text + [[...]] patterns inline — split on pattern boundaries and render each part
    const mixedParts = text.split(/(\[\[[^\]]+\]\])/g).filter(Boolean);
    const hasPattern = mixedParts.some(part => /^\[\[.+\]\]$/.test(part));
    if (hasPattern) {
        return (
            <Typography variant="body1" component="div" sx={{ mb: 1, lineHeight: 1.7, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
                {mixedParts.map((part, index) => {
                    const component = _parseSinglePattern(part);
                    if (component) return <React.Fragment key={index}>{component}</React.Fragment>;
                    return <span key={index}>{part}</span>;
                })}
            </Typography>
        );
    }

    return null;
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
    th: ({ children }) => {
        const text = _extractText(children).trim();
        if (text.includes('[[')) {
            const mixedParts = text.split(/(\[\[[^\]]+\]\])/g).filter(Boolean);
            const hasPattern = mixedParts.some(part => /^\[\[.+\]\]$/.test(part));
            if (hasPattern) {
                return (
                    <TableCell
                        sx={{
                            fontWeight: 'bold',
                            bgcolor: 'action.hover',
                            whiteSpace: 'nowrap',
                            borderBottom: 2,
                            borderColor: 'divider',
                        }}
                    >
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
                            {mixedParts.map((part, index) => {
                                const component = _parseSinglePattern(part);
                                if (component) return <React.Fragment key={index}>{component}</React.Fragment>;
                                return part.trim() ? <span key={index}>{part}</span> : null;
                            })}
                        </Box>
                    </TableCell>
                );
            }
        }
        return (
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
        );
    },
    td: ({ children }) => {
        const text = _extractText(children).trim();
        if (text.includes('[[')) {
            const mixedParts = text.split(/(\[\[[^\]]+\]\])/g).filter(Boolean);
            const hasPattern = mixedParts.some(part => /^\[\[.+\]\]$/.test(part));
            if (hasPattern) {
                return (
                    <TableCell sx={{ borderColor: 'divider' }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
                            {mixedParts.map((part, index) => {
                                const component = _parseSinglePattern(part);
                                if (component) return <React.Fragment key={index}>{component}</React.Fragment>;
                                return part.trim() ? <span key={index}>{part}</span> : null;
                            })}
                        </Box>
                    </TableCell>
                );
            }
        }
        return (
            <TableCell sx={{ borderColor: 'divider' }}>
                {children}
            </TableCell>
        );
    },

    // Typography (with custom component pattern detection)
    p: ({ children }) => {
        const custom = _CustomComponent({ children });
        if (custom) return custom;

        return (
            <Typography variant="body1" sx={{ mb: 1, lineHeight: 1.7 }}>
                {children}
            </Typography>
        );
    },
    h1: ({ children }) => <Typography variant="h5" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>{children}</Typography>,
    h2: ({ children }) => <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>{children}</Typography>,
    h3: ({ children }) => <Typography variant="subtitle1" sx={{ mt: 1.5, mb: 0.5, fontWeight: 'bold' }}>{children}</Typography>,
    h4: ({ children }) => <Typography variant="subtitle2" sx={{ mt: 1.5, mb: 0.5, fontWeight: 'bold' }}>{children}</Typography>,
    h5: ({ children }) => <Typography variant="body2" sx={{ mt: 1.5, mb: 0.5, fontWeight: 'bold' }}>{children}</Typography>,
    h6: ({ children }) => <Typography variant="body2" sx={{ mt: 1.5, mb: 0.5, fontWeight: 'bold', fontSize: '0.9rem' }}>{children}</Typography>,

    // Text styling
    strong: ({ children }) => <Box component="strong" sx={{ fontWeight: 'bold' }}>{children}</Box>,
    em: ({ children }) => <Box component="em" sx={{ fontStyle: 'italic' }}>{children}</Box>,
    del: ({ children }) => <Box component="del" sx={{ textDecoration: 'line-through', color: 'text.secondary', display: 'inline' }}>{children}</Box>,

    // Images
    img: ({ src, alt }) => (
        <Box
            component="img"
            src={src}
            alt={alt}
            sx={{
                maxWidth: '100%',
                height: 'auto',
                borderRadius: 1,
                my: 1.5,
                boxShadow: 1,
            }}
        />
    ),

    // Pre (wrapper für Code-Blöcke)
    pre: ({ children }) => <Box sx={{ my: 1.5 }}>{children}</Box>,

    // Task List Checkboxes (GFM)
    input: ({ checked, ...props }) => (
        <input
            type="checkbox"
            checked={checked}
            disabled
            style={{ marginRight: 8, cursor: 'pointer' }}
            {...props}
        />
    ),

    // Links (footnote anchors scroll instead of navigating)
    a: ({ href, children }) => {
        if (href && (href.startsWith('#user-content-fn-') || href.startsWith('#user-content-fnref-'))) {
            return (
                <Link
                    component="a"
                    href={href}
                    onClick={(e) => {
                        e.preventDefault();
                        const id = href.replace('#', '');
                        const el = document.getElementById(id);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    sx={{ fontSize: '0.75em', verticalAlign: 'super', cursor: 'pointer' }}
                >
                    {children}
                </Link>
            );
        }
        return (
            <Link href={href} target="_blank" rel="noopener noreferrer" underline="hover">
                {children}
            </Link>
        );
    },

    // Lists
    ul: ({ children }) => (
        <Box component="ul" sx={{ pl: 2.5, mb: 1 }}>{children}</Box>
    ),
    ol: ({ children }) => (
        <Box component="ol" sx={{ pl: 2.5, mb: 1 }}>{children}</Box>
    ),
    li: ({ children }) => {
        const text = _extractText(children).trim();
        if (text.includes('[[')) {
            const mixedParts = text.split(/(\[\[[^\]]+\]\])/g).filter(Boolean);
            const hasPattern = mixedParts.some(part => /^\[\[.+\]\]$/.test(part));
            if (hasPattern) {
                return (
                    <Box component="li" sx={{ mb: 0.3, lineHeight: 1.7, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
                        {mixedParts.map((part, index) => {
                            const component = _parseSinglePattern(part);
                            if (component) return <React.Fragment key={index}>{component}</React.Fragment>;
                            return <span key={index}>{part}</span>;
                        })}
                    </Box>
                );
            }
        }
        return (
            <Typography component="li" variant="body1" sx={{ mb: 0.3, lineHeight: 1.7 }}>
                {children}
            </Typography>
        );
    },

    // Blockquote with Callout detection
    blockquote: ({ children }) => {
        const text = React.Children.toArray(children)
            .map(c => (typeof c === 'string' ? c : c?.props?.children || ''))
            .join('');
        const calloutMap = { warning: 'warning', tip: 'info', success: 'success', note: 'info', alert: 'warning', info: 'info' };
        const match = text.match(/\*\*(Warning|Tip|Success|Note|Alert|Info):/i);
        if (match) {
            const severity = calloutMap[match[1].toLowerCase()] || 'info';
            return <Alert severity={severity} sx={{ my: 1 }}>{children}</Alert>;
        }
        return (
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
        );
    },

    // Horizontal rule
    hr: () => <Box component="hr" sx={{ border: 'none', borderTop: 1, borderColor: 'divider', my: 2 }} />,

    // Line break
    br: () => <br />,

    // Details/Summary (Collapsible)
    details: ({ children, ...props }) => (
        <Box
            component="details"
            sx={{
                my: 1.5, px: 1.5, py: 1,
                border: 1, borderColor: 'divider', borderRadius: 1,
                bgcolor: 'action.hover',
                '&[open]': { bgcolor: 'background.paper' },
            }}
            {...props}
        >
            {children}
        </Box>
    ),
    summary: ({ children }) => (
        <Typography
            component="summary"
            sx={{ cursor: 'pointer', fontWeight: 'bold', py: 0.5, '&:hover': { color: 'primary.main' } }}
        >
            {children}
        </Typography>
    ),

    // Footnote superscript
    sup: ({ children }) => (
        <Typography component="sup" variant="caption" sx={{ color: 'primary.main', cursor: 'pointer' }}>
            {children}
        </Typography>
    ),

    // Footnote section styling
    section: ({ children, className, ...props }) => {
        if (className === 'footnotes') {
            return (
                <Box
                    component="section"
                    sx={{ mt: 3, pt: 1, borderTop: 1, borderColor: 'divider', fontSize: '0.85rem', color: 'text.secondary' }}
                    {...props}
                >
                    {children}
                </Box>
            );
        }
        return <section className={className} {...props}>{children}</section>;
    },
};

function ChatMessageContent({ content }) {
    const [copied, setCopied] = React.useState(false);

    // Normalize Unicode dashes/hyphens that break KaTeX
    const normalizedText = content.text
        .replace(/[\u2010-\u2015]/g, '-')
        .replace(/\u00AD/g, '')
        .replace(/\u2011/g, '-');

    const handleCopy = () => {
        navigator.clipboard.writeText(normalizedText);
        setCopied(true);
        setTimeout(() => setCopied(false), 5000);
    };

    return (
        <>
            {/* Main Response */}
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex, rehypeRaw]}
                components={_markdownComponents}
            >
                {normalizedText}
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