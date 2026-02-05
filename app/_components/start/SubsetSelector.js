"use client";

import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import SelectChevron from '@/app/_components/utils/SelectChevron';

const SUBSET_OPTIONS = [
    { label: 'EANCOM', value: 'eancom', description: 'Retail & Distribution', standard: 'un-edifact' },
    { label: 'ODETTE', value: 'odette', description: 'Automotive (European)', standard: 'un-edifact' },
    { label: 'VDA', value: 'vda', description: 'Automotive (German VDA)', standard: 'vda' },
    { label: 'VICS', value: 'vics', description: 'Retail (Voluntary Interindustry Commerce Standards)', standard: 'ansi-x12' },
    { label: 'HIPAA', value: 'hipaa', description: 'Healthcare (US)', standard: 'ansi-x12' },
    { label: 'RosettaNet', value: 'rosettanet', description: 'High-Tech & Electronics Supply Chain', standard: 'xml' },
    { label: 'SAP IDoc', value: 'sap-idoc', description: 'SAP Intermediate Document', standard: 'proprietary' },
    { label: 'SWIFT', value: 'swift', description: 'Financial Messaging (ISO 15022/20022)', standard: 'proprietary' },
    { label: 'Oracle Gateway', value: 'oracle-gateway', description: 'Oracle E-Business Suite EDI Gateway', standard: 'multi' },
];

/**
 * SubsetSelector Component
 * 
 * Dropdown for selecting industry-specific EDI subset or implementation guideline.
 * 
 * @param {Object} props
 * @param {Object} props.value - Currently selected subset
 * @param {Function} props.onChange - Callback when selection changes
 * @param {Object} props.standardFamily - Currently selected standard family (for filtering)
 */
function SubsetSelector({ value, onChange, standardFamily }) {
    // Filter subsets based on selected standard family
    const filteredOptions = standardFamily?.value
        ? SUBSET_OPTIONS.filter(option => 
            option.standard === standardFamily.value || 
            option.standard === 'multi' || 
            option.standard === 'proprietary'
        )
        : SUBSET_OPTIONS;

    return (
        <Box>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                Subset / Industry Implementation Guide (optional)
            </Typography>

            <Autocomplete
                options={filteredOptions}
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
                        placeholder="Select subset..."
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

export default SubsetSelector;
