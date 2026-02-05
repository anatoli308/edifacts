"use client";

import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import SelectChevron from '@/app/_components/utils/SelectChevron';

const STANDARD_FAMILY_OPTIONS = [
    { label: 'UN/EDIFACT', value: 'un-edifact', description: 'United Nations EDI for Administration, Commerce and Transport' },
    { label: 'ANSI ASC X12', value: 'ansi-x12', description: 'American National Standards Institute X12' },
    { label: 'TRADACOMS', value: 'tradacoms', description: 'Trading Data Communications Standard (UK)' },
    { label: 'VDA', value: 'vda', description: 'Verband der Automobilindustrie (German Automotive)' },
];

/**
 * StandardFamilySelector Component
 * 
 * Dropdown for selecting the main EDI standard/syntax family.
 * 
 * @param {Object} props
 * @param {Object} props.value - Currently selected standard family
 * @param {Function} props.onChange - Callback when selection changes
 */
function StandardFamilySelector({ value, onChange }) {
    return (
        <Box>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                Standard / Syntax Family (optional)
            </Typography>

            <Autocomplete
                options={STANDARD_FAMILY_OPTIONS}
                getOptionLabel={(option) => option.label}
                value={value}
                onChange={(event, newValue) => onChange(newValue)}
                sx={{ minWidth: 300 }}
                slotProps={{
                    popupIndicator: {
                        component: SelectChevron
                    }
                }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        placeholder="Select standard..."
                    />
                )}
                renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.value}>
                        <Box>
                            <Typography variant="body2">{option.label}</Typography>
                            <Typography variant="caption" color="textSecondary">
                                {option.description}
                            </Typography>
                        </Box>
                    </Box>
                )}
            />
        </Box>
    );
}

export default StandardFamilySelector;
