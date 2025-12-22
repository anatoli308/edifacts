import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Paper,
    Typography,
    alpha
} from '@mui/material';
import { useState } from 'react';

//app imports
import Iconify from '@/app/_components/utils/Iconify';

function ChatMessageToolCalls({ toolCalls }) {
    const [expanded, setExpanded] = useState(false);

    const handleExpand = (event, isExpanded) => {
        setExpanded(isExpanded);
    };
    return (
        <Accordion
            disableGutters
            elevation={0}
            expanded={expanded}
            onChange={handleExpand}
            sx={{
                mb: 1,
                '&:before': { display: 'none' },
                backgroundColor: alpha('#ff9800', 0.05),
                border: '1px solid',
                borderColor: alpha('#ff9800', 0.2)
            }}
        >
            <AccordionSummary
                expandIcon={<Iconify icon="mdi:chevron-down" />}
                sx={{
                    minHeight: 40,
                    '& .MuiAccordionSummary-content': { my: 0.5 }
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Iconify icon="mdi:build" sx={{ fontSize: 18, color: '#ff9800' }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#ff9800' }}>
                        Tool Calls ({toolCalls.length})
                    </Typography>
                </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {toolCalls.map((tool, idx) => (
                        <Paper key={idx} sx={{ p: 1.5, backgroundColor: 'background.default' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <Iconify icon="mdi:code-tags" sx={{ fontSize: 16, color: 'text.secondary' }} />
                                <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                                    {tool.name}
                                </Typography>
                            </Box>
                            {tool.result && (
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                                    {tool.result}
                                </Typography>
                            )}
                        </Paper>
                    ))}
                </Box>
            </AccordionDetails>
        </Accordion>
    );
}

export default ChatMessageToolCalls;
