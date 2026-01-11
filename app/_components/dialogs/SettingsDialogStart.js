import {
    Avatar,
    Box,
    Divider,
    FormControlLabel,
    Radio,
    RadioGroup,
    ToggleButton,
    ToggleButtonGroup,
    Typography
} from '@mui/material';
import { useState } from 'react';

//app imports
import Iconify from '@/app/_components/utils/Iconify';
import { useThemeConfig } from '@/app/_contexts/ThemeContext';

function BpRadio(props) {
    return (
        <Radio
            disableRipple
            color="default"
            checkedIcon={
                <Avatar sx={{ bgcolor: props.value, width: 32, height: 32 }}>
                    <Iconify icon="mdi:check" sx={{ fontSize: 20 }} />
                </Avatar>
            }
            icon={
                <Avatar
                    alt="color"
                    sx={{ bgcolor: props.value, width: 32, height: 32 }}
                    
                >O</Avatar>
            }
            {...props}
        />
    );
}

function SettingsDialogStart() {
    const { themeBackground, updateBackground } = useThemeConfig();
    const [accentColor, setAccentColor] = useState('#2065D1');

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
                Settings
            </Typography>
            <Divider sx={{ my: 2 }} />

            {/* Theme Background - Inline */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="body2">Theme</Typography>
                    <Typography variant="caption" color="textSecondary">
                        Choose your preferred background
                    </Typography>
                </Box>
                <ToggleButtonGroup
                    size="small"
                    color="primary"
                    value={themeBackground}
                    exclusive
                    onChange={(_, value) => value && updateBackground(value)}>
                    <ToggleButton value="white">Light</ToggleButton>
                    <ToggleButton value="#1a2a3b">Dim</ToggleButton>
                    <ToggleButton value="black">Dark</ToggleButton>
                </ToggleButtonGroup>
            </Box>

            <Divider sx={{ my: 1 }} />

            {/* Font Accent Color - Inline */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="body2">Accent Color</Typography>
                    <Typography variant="caption" color="textSecondary">
                        Choose your preferred accent color
                    </Typography>
                </Box>
                <RadioGroup
                    row
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    sx={{ gap: 1 }}
                >
                    <FormControlLabel value="#2065D1" control={<BpRadio />} label="" />
                    <FormControlLabel value="#ffeb3b" control={<BpRadio />} label="" />
                    <FormControlLabel value="#e91e63" control={<BpRadio />} label="" />
                    <FormControlLabel value="#9c27b0" control={<BpRadio />} label="" />
                    <FormControlLabel value="#ff9800" control={<BpRadio />} label="" />
                    <FormControlLabel value="#4caf50" control={<BpRadio />} label="" />
                </RadioGroup>
            </Box>

            <Divider sx={{ my: 1 }} />

        </Box>
    );
}

export default SettingsDialogStart;