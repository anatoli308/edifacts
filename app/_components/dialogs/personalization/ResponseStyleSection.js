import { useState } from 'react';
import { Box, MenuItem, Select, Typography } from '@mui/material';
import SectionRow from './SectionRow';
//TODO - NOT USED MAYBE NEED LATER InlinePreferenceSelect
const ResponseStyleSection = () => {
    const [style, setStyle] = useState('default');
    const options = [
        { value: 'default', label: 'Default', caption: 'Typical response style' },
        { value: 'analyst', label: 'Analyst', caption: 'Deep technical insights' },
        { value: 'manager', label: 'Manager', caption: 'Executive focused' },
        { value: 'business', label: 'Business', caption: 'Impact & compliance' },
        { value: 'tech', label: 'Tech', caption: 'Debug & validation' }
    ];

    return (
        <SectionRow>
            <Box>
                <Typography variant="body2">Response Style</Typography>
                <Typography variant="caption" color="textSecondary">
                    Select how the AI should responds
                </Typography>
            </Box>
            <Select size="small" value={style} onChange={(event) => setStyle(event.target.value)} sx={{ minWidth: 250 }}>
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

export default ResponseStyleSection;
