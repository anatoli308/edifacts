"use client";

import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import SelectChevron from '@/app/_components/utils/SelectChevron';

const VERSION_OPTIONS = {
    'un-edifact': [
        { label: 'D96A', value: 'd96a', year: '1996' },
        { label: 'D96B', value: 'd96b', year: '1996' },
        { label: 'D97A', value: 'd97a', year: '1997' },
        { label: 'D97B', value: 'd97b', year: '1997' },
        { label: 'D98A', value: 'd98a', year: '1998' },
        { label: 'D98B', value: 'd98b', year: '1998' },
        { label: 'D99A', value: 'd99a', year: '1999' },
        { label: 'D99B', value: 'd99b', year: '1999' },
        { label: 'D00A', value: 'd00a', year: '2000' },
        { label: 'D00B', value: 'd00b', year: '2000' },
        { label: 'D01A', value: 'd01a', year: '2001' },
        { label: 'D01B', value: 'd01b', year: '2001' },
        { label: 'D02A', value: 'd02a', year: '2002' },
        { label: 'D02B', value: 'd02b', year: '2002' },
        { label: 'D03A', value: 'd03a', year: '2003' },
        { label: 'D03B', value: 'd03b', year: '2003' },
        { label: 'D04A', value: 'd04a', year: '2004' },
        { label: 'D04B', value: 'd04b', year: '2004' },
        { label: 'D07A', value: 'd07a', year: '2007' },
        { label: 'D07B', value: 'd07b', year: '2007' },
        { label: 'D08A', value: 'd08a', year: '2008' },
        { label: 'D08B', value: 'd08b', year: '2008' },
        { label: 'D09A', value: 'd09a', year: '2009' },
        { label: 'D09B', value: 'd09b', year: '2009' },
        { label: 'D10A', value: 'd10a', year: '2010' },
        { label: 'D10B', value: 'd10b', year: '2010' },
        { label: 'D12A', value: 'd12a', year: '2012' },
        { label: 'D12B', value: 'd12b', year: '2012' },
        { label: 'D14A', value: 'd14a', year: '2014' },
        { label: 'D14B', value: 'd14b', year: '2014' },
        { label: 'D16A', value: 'd16a', year: '2016' },
        { label: 'D16B', value: 'd16b', year: '2016' },
        { label: 'D18A', value: 'd18a', year: '2018' },
        { label: 'D18B', value: 'd18b', year: '2018' },
        { label: 'D20A', value: 'd20a', year: '2020' },
        { label: 'D20B', value: 'd20b', year: '2020' },
        { label: 'D22A', value: 'd22a', year: '2022' },
        { label: 'D22B', value: 'd22b', year: '2022' },
    ],
    'ansi-x12': [
        { label: '3010', value: '3010', year: '1989' },
        { label: '3020', value: '3020', year: '1990' },
        { label: '3030', value: '3030', year: '1991' },
        { label: '3040', value: '3040', year: '1992' },
        { label: '3050', value: '3050', year: '1993' },
        { label: '3060', value: '3060', year: '1994' },
        { label: '3070', value: '3070', year: '1995' },
        { label: '4010', value: '4010', year: '1997' },
        { label: '4020', value: '4020', year: '1998' },
        { label: '4030', value: '4030', year: '1999' },
        { label: '4040', value: '4040', year: '2000' },
        { label: '4050', value: '4050', year: '2001' },
        { label: '4060', value: '4060', year: '2002' },
        { label: '5010', value: '5010', year: '2003' },
        { label: '5020', value: '5020', year: '2005' },
        { label: '5030', value: '5030', year: '2007' },
        { label: '5040', value: '5040', year: '2009' },
        { label: '5050', value: '5050', year: '2011' },
        { label: '6010', value: '6010', year: '2013' },
        { label: '6020', value: '6020', year: '2015' },
        { label: '7010', value: '7010', year: '2017' },
        { label: '7020', value: '7020', year: '2019' },
        { label: '7030', value: '7030', year: '2020' },
        { label: '8010', value: '8010', year: '2021' },
        { label: '8020', value: '8020', year: '2023' },
        { label: '8030', value: '8030', year: '2024' },
    ],
    'tradacoms': [
        { label: 'Release 1', value: 'r1', year: '1982' },
        { label: 'Release 2', value: 'r2', year: '1986' },
        { label: 'Release 3', value: 'r3', year: '1995' },
    ],
    'vda': [
        { label: 'VDA 4905', value: '4905', year: 'Delivery Schedule' },
        { label: 'VDA 4906', value: '4906', year: 'Despatch Advice' },
        { label: 'VDA 4908', value: '4908', year: 'Invoice' },
        { label: 'VDA 4913', value: '4913', year: 'Call-off/Release' },
    ],
};

/**
 * VersionReleaseSelector Component
 * 
 * Dropdown for selecting the version/release of the EDI standard.
 * Options change dynamically based on the selected standard family.
 * 
 * @param {Object} props
 * @param {Object} props.value - Currently selected version
 * @param {Function} props.onChange - Callback when selection changes
 * @param {Object} props.standardFamily - Currently selected standard family (determines available versions)
 */
function VersionReleaseSelector({ value, onChange, standardFamily }) {
    const options = standardFamily?.value 
        ? VERSION_OPTIONS[standardFamily.value] || []
        : [];

    const isDisabled = !standardFamily?.value || options.length === 0;

    return (
        <Box>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                Version / Release (optional)
            </Typography>

            <Autocomplete
                options={options}
                getOptionLabel={(option) => option.label}
                value={value}
                onChange={(event, newValue) => onChange(newValue)}
                disabled={isDisabled}
                sx={{ minWidth: 300 }}
                slotProps={{
                    popupIndicator: {
                        component: SelectChevron
                    }
                }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        placeholder={isDisabled ? "Select standard first..." : "Select version..."}
                    />
                )}
                renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.value}>
                        <Box>
                            <Typography variant="body2">{option.label}</Typography>
                            <Typography variant="caption" color="textSecondary">
                                {option.year}
                            </Typography>
                        </Box>
                    </Box>
                )}
            />
        </Box>
    );
}

export default VersionReleaseSelector;
