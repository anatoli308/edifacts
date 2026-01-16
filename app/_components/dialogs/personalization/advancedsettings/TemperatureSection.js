import { useState } from 'react';
import { Box, Slider, Typography } from '@mui/material';
import SectionRow from '../SectionRow';

const TemperatureSection = () => {
    const [temperature, setTemperature] = useState(0.7);

    return (
        <SectionRow>
            <Box>
                <Typography variant="body2">Temperature / Creativity</Typography>
                <Typography variant="caption" color="textSecondary">
                    Response randomness (0 = deterministic, 1 = creative)
                </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 250 }}>
                <Slider
                    value={temperature}
                    onChange={(event, newValue) => setTemperature(newValue)}
                    min={0}
                    max={1}
                    step={0.1}
                    marks={[
                        { value: 0, label: 'Precise' },
                        { value: 0.5, label: 'Balanced' },
                        { value: 1, label: 'Creative' }
                    ]}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => value.toFixed(1)}
                    sx={{ flex: 1 }}
                />
                <Typography variant="body2" sx={{ minWidth: 10, textAlign: 'center' }}>
                    {temperature.toFixed(1)}
                </Typography>
            </Box>
        </SectionRow>
    );
};

export default TemperatureSection;
