import { useState } from 'react';
import { Box, TextField, Typography } from '@mui/material';

const PersonalizedBehaviorInput = () => {
    const [value, setValue] = useState('');

    return (
        <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>Personalized Behavior</Typography>
            <TextField
                fullWidth
                size="small"
                placeholder="Describe how you'd like the AI to behave..."
                value={value}
                onChange={(event) => setValue(event.target.value)}
                multiline
                minRows={3}
                maxRows={12}
            />
        </Box>
    );
};

export default PersonalizedBehaviorInput;
