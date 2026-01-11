import { useState } from 'react';
import { Box, Divider, TextField, Typography } from '@mui/material';

const AboutYouSection = () => {
    const [nickname, setNickname] = useState('');
    const [occupation, setOccupation] = useState('');
    const [aboutMe, setAboutMe] = useState('');

    return (
        <Box sx={{ mt: 4 }}>
            <Typography variant="subtitle1" gutterBottom>
                About You
            </Typography>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>Nickname</Typography>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Your nickname"
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                />
            </Box>
            <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>Occupation</Typography>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Your occupation"
                    value={occupation}
                    onChange={(event) => setOccupation(event.target.value)}
                />
            </Box>
            <Box>
                <Typography variant="body2" sx={{ mb: 1 }}>More About You</Typography>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Tell us more about yourself..."
                    value={aboutMe}
                    onChange={(event) => setAboutMe(event.target.value)}
                    multiline
                    minRows={1}
                    maxRows={3}
                />
            </Box>
        </Box>
    );
};

export default AboutYouSection;
