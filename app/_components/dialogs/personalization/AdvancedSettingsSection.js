import InlinePreferenceSelect from '@/app/_components/dialogs/personalization/InlinePreferenceSelect';
import Iconify from '@/app/_components/utils/Iconify';
import { Accordion, AccordionDetails, AccordionSummary, Typography } from '@mui/material';
import InternetSearchSection from '@/app/_components/dialogs/personalization/advancedsettings/InternetSearchSection';
import TemperatureSection from '@/app/_components/dialogs/personalization/advancedsettings/TemperatureSection';

const contextWindowOptions = [
    { value: 2000, label: '2K tokens', caption: 'Last 5-10 messages' },
    { value: 4000, label: '4K tokens', caption: 'Last 10-15 messages' },
    { value: 8000, label: '8K tokens', caption: 'Last 20-30 messages' },
    { value: 16000, label: '16K tokens', caption: 'Last 40-50 messages' },
    { value: 32000, label: '32K tokens', caption: 'Full conversation' }
];
const AdvancedSettingsSection = () => {
    return (
        <Accordion sx={{ p: 0 }}>
            <AccordionSummary
                expandIcon={<Iconify icon="mdi:chevron-down" sx={{ fontSize: 24 }} />}
                sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0 }}
            >
                <Typography variant="subtitle1">Advanced</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
                <TemperatureSection />
                <InlinePreferenceSelect
                    options={contextWindowOptions}
                    label="Context Window Size"
                    isDetailed
                    defaultValue={8000}
                    description="How much chat history the AI should consider" />
                <InternetSearchSection />
            </AccordionDetails>
        </Accordion>
    );
};

export default AdvancedSettingsSection;
