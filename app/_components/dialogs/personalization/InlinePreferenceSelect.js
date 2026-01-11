import { useState } from 'react';
import { Box, MenuItem, Select, Typography } from '@mui/material';
import Iconify from '@/app/_components/utils/Iconify';
import SectionRow from './SectionRow';

const SelectChevron = (props) => (
    <Iconify icon="mdi:chevron-down" sx={{ fontSize: 18 }} {...props} />
);

const InlineOptionMenuItem = ({ option, active }) => (
    <MenuItem value={option.value} dense>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="body2" color={active ? 'primary' : 'textPrimary'}>
                    {option.label}
                </Typography>
                <Typography variant="caption" color="textSecondary">{option.caption}</Typography>
            </Box>
            {active && <Iconify icon="mdi:check" sx={{ fontSize: 18, color: 'primary.main' }} />}
        </Box>
    </MenuItem>
);

const InlinePreferenceSelect = ({ label, description }) => {
    const [value, setValue] = useState('default');
    const options = [
        { value: 'more', label: 'More', caption: 'Extensive use' },
        { value: 'default', label: 'Default', caption: 'Balanced use' },
        { value: 'less', label: 'Less', caption: 'Minimal use' }
    ];

    return (
        <SectionRow sx={{ mb: 2 }}>
            <Box>
                <Typography variant="body2">{label}</Typography>
                <Typography variant="caption" color="textSecondary">
                    {description}
                </Typography>
            </Box>
            <Select
                size="small"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                sx={{ minWidth: 200 }}
                IconComponent={SelectChevron}
                renderValue={(selected) => (
                    <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                        {selected}
                    </Typography>
                )}
            >
                {options.map((option) => (
                    <InlineOptionMenuItem key={option.value} option={option} active={value === option.value} />
                ))}
            </Select>
        </SectionRow>
    );
};

export default InlinePreferenceSelect;
