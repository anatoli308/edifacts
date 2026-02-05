"use client";

import { Autocomplete, Box, TextField, Typography } from '@mui/material';

import SelectChevron from '@/app/_components/utils/SelectChevron';

const MESSAGE_TYPE_OPTIONS = [
    { label: 'ORDERS - Purchase Order', value: 'ORDERS', description: 'Purchase order message' },
    { label: 'INVOIC - Invoice', value: 'INVOIC', description: 'Invoice message' },
    { label: 'DESADV - Despatch Advice', value: 'DESADV', description: 'Despatch advice message' },
    { label: 'ORDRSP - Purchase Order Response', value: 'ORDRSP', description: 'Purchase order response message' },
    { label: 'PRICAT - Price/Sales Catalogue', value: 'PRICAT', description: 'Price/sales catalogue message' },
    { label: 'RECADV - Receiving Advice', value: 'RECADV', description: 'Receiving advice message' },
    { label: 'REMADV - Remittance Advice', value: 'REMADV', description: 'Remittance advice message' },
    { label: 'IFTMIN - Instruction to Dispatch', value: 'IFTMIN', description: 'Forwarding and transport message' },
    { label: 'IFTSTA - Status Report', value: 'IFTSTA', description: 'International multimodal status report' },
    { label: 'CUSDEC - Customs Declaration', value: 'CUSDEC', description: 'Customs declaration message' },
    { label: 'APERAK - Application Error', value: 'APERAK', description: 'Application error and acknowledgement' },
    { label: 'CONTRL - Syntax Report', value: 'CONTRL', description: 'Syntax and service report message' },
    { label: 'DELFOR - Delivery Schedule', value: 'DELFOR', description: 'Delivery schedule message' },
    { label: 'DELJIT - Delivery Just In Time', value: 'DELJIT', description: 'Delivery just in time message' },
    { label: 'INVRPT - Inventory Report', value: 'INVRPT', description: 'Inventory report message' },
    { label: 'SLSRPT - Sales Report', value: 'SLSRPT', description: 'Sales data report message' },
    { label: 'QUOTES - Quote', value: 'QUOTES', description: 'Quote message' },
    { label: 'HANMOV - Cargo Handling', value: 'HANMOV', description: 'Cargo/goods handling and movement message' },
    { label: 'PARTIN - Party Information', value: 'PARTIN', description: 'Party information message' },
    { label: 'PRODAT - Product Data', value: 'PRODAT', description: 'Product data message' },
    { label: 'REQOTE - Request for Quote', value: 'REQOTE', description: 'Request for quote message' },
    { label: 'BANSTA - Bank Statement', value: 'BANSTA', description: 'Banking status message' },
    { label: 'PAYMUL - Multiple Payment', value: 'PAYMUL', description: 'Multiple payment order message' },
    { label: 'CREADV - Credit Advice', value: 'CREADV', description: 'Credit advice message' },
    { label: 'CASRES - Response to Query', value: 'CASRES', description: 'Response to query message' },
];

/**
 * MessageTypeSelector Component
 * 
 * Dropdown for selecting the EDI message type (e.g., ORDERS, INVOIC, DESADV).
 * 
 * @param {Object} props
 * @param {Object} props.value - Currently selected message type
 * @param {Function} props.onChange - Callback when selection changes
 */
function MessageTypeSelector({ value, onChange }) {
    return (
        <Box>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                Message Type (optional)
            </Typography>

            <Autocomplete
                options={MESSAGE_TYPE_OPTIONS}
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
                        placeholder="Select message type..."
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

export default MessageTypeSelector;
