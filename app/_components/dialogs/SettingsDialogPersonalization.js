import { Box, Divider, Typography } from '@mui/material';

import AboutYouSection from '@/app/_components/dialogs/personalization/AboutYouSection';
import AdvancedSettingsSection from '@/app/_components/dialogs/personalization/AdvancedSettingsSection';
import InlinePreferenceSelect from '@/app/_components/dialogs/personalization/InlinePreferenceSelect';
import MemorySettingsSection from '@/app/_components/dialogs/personalization/MemorySettingsSection';
import PersonalizedBehaviorInput from '@/app/_components/dialogs/personalization/PersonalizedBehaviorInput';
import ResponseStyleSection from '@/app/_components/dialogs/personalization/ResponseStyleSection';

function SettingsDialogPersonalization() {
    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
                Personalization
            </Typography>
            <Divider sx={{ my: 2 }} />

            <ResponseStyleSection />

            <Box sx={{ my: 2 }}>
                <Typography variant="body2">Customization</Typography>
                <Typography variant="caption" color="textSecondary">
                    Select additional customization options for your AI responses
                </Typography>
            </Box>

            <InlinePreferenceSelect
                label="Headlines and Lists"
                description="Control the use of headlines and lists" />
            <InlinePreferenceSelect
                label="Tables"
                description="Control the use of tables" />
            <InlinePreferenceSelect
                label="Charts and Visualizations"
                description="Control the use of charts and visual elements" />
            <InlinePreferenceSelect
                label="Emojis"
                description="Control the use of emojis" />
                
            <PersonalizedBehaviorInput />
            <AboutYouSection />
            <MemorySettingsSection />
            <AdvancedSettingsSection />
        </Box>
    );
}

export default SettingsDialogPersonalization;