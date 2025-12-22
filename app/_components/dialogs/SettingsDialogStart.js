import {
    Box,
    Typography,
    ToggleButton,
    ToggleButtonGroup,
} from '@mui/material';

//app imports
import { useThemeConfig } from '@/app/_contexts/ThemeContext';

function SettingsDialogStart() {
    const { themeBackground, handlers } = useThemeConfig();

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
                Settings
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Configure your preferences
            </Typography>
            <ToggleButtonGroup
                size="small"
                color="primary"
                value={themeBackground}
                exclusive
                onChange={(_, value) => value && handlers.updateBackground(value)}>
                <ToggleButton value="white">Light</ToggleButton>
                <ToggleButton value="#1a2a3b">Dim</ToggleButton>
                <ToggleButton value="black">Dark</ToggleButton>
            </ToggleButtonGroup>
        </Box>
    );
}

export default SettingsDialogStart;