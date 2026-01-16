import { Box, Divider, Typography } from '@mui/material';

import AboutYouSection from '@/app/_components/dialogs/personalization/AboutYouSection';
import AdvancedSettingsSection from '@/app/_components/dialogs/personalization/AdvancedSettingsSection';
import InlinePreferenceSelect from '@/app/_components/dialogs/personalization/InlinePreferenceSelect';
import MemorySettingsSection from '@/app/_components/dialogs/personalization/MemorySettingsSection';
import PersonalizedBehaviorInput from '@/app/_components/dialogs/personalization/PersonalizedBehaviorInput';

const moreOrLessOptions = [
    { value: 'more', label: 'More', caption: 'Extensive use' },
    { value: 'default', label: 'Default', caption: 'Balanced use' },
    { value: 'less', label: 'Less', caption: 'Minimal use' }
];
const languageOptions = [
    { value: 'automatic', label: 'Automatic', caption: 'Detect from system/memory' },
    { value: 'en', label: 'English', caption: 'English (US)' },
    { value: 'de', label: 'Deutsch', caption: 'German (DE)' },
    { value: 'fr', label: 'Français', caption: 'French (FR)' },
    { value: 'es', label: 'Español', caption: 'Spanish (ES)' },
    { value: 'it', label: 'Italiano', caption: 'Italian (IT)' },
    { value: 'nl', label: 'Nederlands', caption: 'Dutch (NL)' },
    { value: 'pt', label: 'Português', caption: 'Portuguese (PT)' }
];
const responseStyleOptions = [
    { value: 'default', label: 'Default', caption: 'Typical response style' },
    { value: 'analyst', label: 'Analyst', caption: 'Deep technical insights' },
    { value: 'manager', label: 'Manager', caption: 'Executive focused' },
    { value: 'business', label: 'Business', caption: 'Impact & compliance' },
    { value: 'tech', label: 'Tech', caption: 'Debug & validation' }
];

const responseLengthOptions = [
    { value: 'short', label: 'Short', caption: 'Concise & quick answers' },
    { value: 'balanced', label: 'Balanced', caption: 'Moderate detail level' },
    { value: 'detailed', label: 'Detailed', caption: 'Comprehensive & thorough' },
    { value: 'expert', label: 'Expert', caption: 'In-depth with technical depth' }
];
function SettingsDialogPersonalization() {
    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
                Personalization
            </Typography>
            <Divider sx={{ my: 2 }} />

            <InlinePreferenceSelect
                options={languageOptions}
                isDetailed
                defaultValue='automatic'
                label="Language"
                description="Select response language for AI explanations" />

            <InlinePreferenceSelect
                options={responseStyleOptions}
                isDetailed
                label="Response Style"
                description="Select how the AI should responds" />

            <InlinePreferenceSelect
                options={responseLengthOptions}
                isDetailed
                defaultValue='balanced'
                label="Response Length"
                description="How detailed should AI responses be" />

            <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1">Customization</Typography>
                <Typography variant="caption" color="textSecondary">
                    Select additional customization options for your AI responses
                </Typography>
            </Box>

            <InlinePreferenceSelect
                options={moreOrLessOptions}
                label="Headlines and Lists"
                description="Control the use of headlines and lists" />
            <InlinePreferenceSelect
                options={moreOrLessOptions}
                label="Tables"
                description="Control the use of tables" />
            <InlinePreferenceSelect
                options={moreOrLessOptions}
                label="Charts and Visualizations"
                description="Control the use of charts and visual elements" />
            <InlinePreferenceSelect
                options={moreOrLessOptions}
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