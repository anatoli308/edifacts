import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Chip,
    Typography,
    alpha
} from '@mui/material';
import { useState } from 'react';

//app imports
import Iconify from '@/app/_components/utils/Iconify';

function ChatMessageSteps({ steps }) {
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
                backgroundColor: alpha('#2196f3', 0.05),
                border: '1px solid',
                borderColor: alpha('#2196f3', 0.2)
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
                    <Iconify icon="mdi:format-list-numbered" sx={{ fontSize: 18, color: '#2196f3' }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#2196f3' }}>
                        Steps ({steps.length})
                    </Typography>
                </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {steps.map((step, idx) => (
                        <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                            <Chip
                                label={idx + 1}
                                size="small"
                                sx={{ minWidth: 24, height: 24, fontSize: '0.75rem' }}
                            />
                            <Typography variant="body2" sx={{ flex: 1, color: 'text.secondary' }}>
                                {step}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            </AccordionDetails>
        </Accordion>
    );
}

export default ChatMessageSteps;
