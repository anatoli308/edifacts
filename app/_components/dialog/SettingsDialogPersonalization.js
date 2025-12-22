"use client";

import {
    Box,
    Typography,
} from '@mui/material';

function SettingsDialogPersonalization() {
    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
                Personalization
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Customize your experience
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Theme, layout, and other personalization options coming soon...
            </Typography>
        </Box>
    );
}

export default SettingsDialogPersonalization;