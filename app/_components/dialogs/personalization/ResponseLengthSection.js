import { useState } from 'react';
import { Box, MenuItem, Select, Typography } from '@mui/material';
import SectionRow from './SectionRow';
//TODO - NOT USED MAYBE NEED LATER InlinePreferenceSelect
const ResponseLengthSection = () => {
    const [length, setLength] = useState('balanced');
    const options = [
        { value: 'short', label: 'Short', caption: 'Concise & quick answers' },
        { value: 'balanced', label: 'Balanced', caption: 'Moderate detail level' },
        { value: 'detailed', label: 'Detailed', caption: 'Comprehensive & thorough' },
        { value: 'expert', label: 'Expert', caption: 'In-depth with technical depth' }
    ];

    return (
        <SectionRow>
            <Box>
                <Typography variant="body2">Response Length</Typography>
                <Typography variant="caption" color="textSecondary">
                    How detailed should AI responses be
                </Typography>
            </Box>
            <Select size="small" value={length} onChange={(event) => setLength(event.target.value)} sx={{ minWidth: 250 }}>
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

export default ResponseLengthSection;
