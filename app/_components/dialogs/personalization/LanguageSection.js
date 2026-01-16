import { useState } from 'react';
import { Box, MenuItem, Select, Typography } from '@mui/material';
import SectionRow from './SectionRow';

const LanguageSection = () => {
    const [language, setLanguage] = useState('automatic');
    const options = [
        { value: 'automatic', label: 'Automatic', caption: 'Detect from system/memory' },
        { value: 'en', label: 'English', caption: 'English (US)' },
        { value: 'de', label: 'Deutsch', caption: 'German (DE)' },
        { value: 'fr', label: 'Français', caption: 'French (FR)' },
        { value: 'es', label: 'Español', caption: 'Spanish (ES)' },
        { value: 'it', label: 'Italiano', caption: 'Italian (IT)' },
        { value: 'nl', label: 'Nederlands', caption: 'Dutch (NL)' },
        { value: 'pt', label: 'Português', caption: 'Portuguese (PT)' }
    ];

    return (
        <SectionRow>
            <Box sx={{ maxWidth: 'calc(100% - 260px)', minWidth: 0 }}>
                <Typography variant="body2">Language</Typography>
                <Typography
                    variant="caption"
                    color="textSecondary"
                    sx={{
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}
                >
                    Select response language for AI explanations
                </Typography>
            </Box>
            <Select size="small" value={language} onChange={(event) => setLanguage(event.target.value)} sx={{ minWidth: 250 }}>
                {options.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body2">{option.label}</Typography>
                            <Typography variant="caption" color="textSecondary">{option.caption}</Typography>
                        </Box>
                    </MenuItem>
                ))}
            </Select>
        </SectionRow>
    );
};

export default LanguageSection;
