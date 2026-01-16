import { useState } from 'react';
import { Box, FormControlLabel, Switch, Typography } from '@mui/material';
import SectionRow from '../SectionRow';

const InternetSearchSection = () => {
    const [useInternetSearch, setUseInternetSearch] = useState(true);

    return (
        <SectionRow>
            <Box>
                <Typography variant="body2">Internet search</Typography>
                <Typography variant="caption" color="textSecondary">
                    Let EDIFACTS access and retrieve real-time information from the internet
                </Typography>
            </Box>
            <FormControlLabel
                control={<Switch checked={useInternetSearch} onChange={(event) => setUseInternetSearch(event.target.checked)} />}
                label=""
                sx={{ m: 0 }}
            />
        </SectionRow>
    );
};

export default InternetSearchSection;
