import Iconify from '@/app/_components/utils/Iconify';
import SelectChevron from '@/app/_components/utils/SelectChevron';
import { Box, MenuItem, Select, Typography } from '@mui/material';
import { useState } from 'react';
import SectionRow from './SectionRow';

const InlinePreferenceSelect = ({ options, label, description, isDetailed = false, defaultValue = 'default' }) => {
    const [value, setValue] = useState(defaultValue);

    return (
        <SectionRow sx={{ mb: 2 }}>
            <Box sx={{ maxWidth: 'calc(100% - 260px)', minWidth: 0 }}>
                <Typography variant="body2">{label}</Typography>
                <Typography variant="caption" color="textSecondary" sx={{
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    {description}
                </Typography>
            </Box>
            <Select
                size="small"
                value={value}
                onChange={(event) => { setValue(event.target.value) }}
                sx={{ minWidth: 250 }}
                IconComponent={SelectChevron}
                renderValue={(selected) => {
                    const selectedOption = options.find(opt => opt.value === selected);
                    return (
                        <>
                            <Typography variant="body2">
                                {selectedOption?.label || selected}
                            </Typography>
                            {isDetailed ? (<Typography variant="caption" color="textSecondary">{selectedOption?.caption}</Typography>) : null}
                        </>
                    );
                }}
            >
                {options.map((option) => (
                    <MenuItem key={option.value} value={option.value} dense>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="body2" color={value === option.value ? 'primary' : 'textPrimary'}>
                                    {option.label}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">{option.caption}</Typography>
                            </Box>
                            {value === option.value && <Iconify icon="mdi:check" sx={{ fontSize: 18, color: 'primary.main' }} />}
                        </Box>
                    </MenuItem>
                ))}
            </Select>
        </SectionRow>
    );
};

export default InlinePreferenceSelect;
