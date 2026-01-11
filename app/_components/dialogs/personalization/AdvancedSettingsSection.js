import { useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Box, FormControlLabel, Switch, Typography } from '@mui/material';
import Iconify from '@/app/_components/utils/Iconify';
import SectionRow from './SectionRow';

const AdvancedSettingsSection = () => {
    const [useInternetSearch, setUseInternetSearch] = useState(true);

    return (
        <Accordion sx={{ p: 0 }}>
            <AccordionSummary
                expandIcon={<Iconify icon="mdi:chevron-down" sx={{ fontSize: 24 }} />}
                sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0 }}
            >
                <Typography variant="subtitle1">Advanced</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
                <SectionRow>
                    <Box>
                        <Typography variant="body2">Internet search</Typography>
                        <Typography variant="caption" color="textSecondary">
                            Let EDIFACTS access and retrieve real-time information from the internet
                        </Typography>
                    </Box>
                    <FormControlLabel
                        control={<Switch checked={useInternetSearch} onChange={(event) => setUseInternetSearch(event.target.checked)} />}
                        label=""
                        sx={{ m: 0 }}
                    />
                </SectionRow>
            </AccordionDetails>
        </Accordion>
    );
};

export default AdvancedSettingsSection;
