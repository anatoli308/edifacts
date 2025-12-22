import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    alpha,
    Box, Typography
} from '@mui/material';
import { useState } from 'react';

//app imports
import Iconify from '@/app/_components/Iconify';

function ChatMessageReasoning({ reasoning }) {
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
                backgroundColor: alpha('#9c27b0', 0.05),
                border: '1px solid',
                borderColor: alpha('#9c27b0', 0.2)
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
                    <Iconify icon="mdi:psychology" sx={{ fontSize: 18, color: '#9c27b0' }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#9c27b0' }}>
                        Reasoning
                    </Typography>
                </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
                    {reasoning}
                </Typography>
            </AccordionDetails>
        </Accordion>
    );
}

export default ChatMessageReasoning;
