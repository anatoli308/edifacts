'use client';

import { useEffect, useState } from 'react';
import { Box, CircularProgress, Container, Typography } from '@mui/material';

const MIN_LOADING_TIME = 1500; // 1.5 seconds minimum display time

export default function SplashScreen({
    children,
    updateFontColor,
    updateBackground,
    updateFontSize,
}) {
    const [isVisible, setIsVisible] = useState(true);
    const [startTime] = useState(Date.now());

    useEffect(() => {
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime);

        const timer = setTimeout(() => {
            setIsVisible(false);
        }, remainingTime);

        return () => clearTimeout(timer);
    }, [startTime]);

    if (isVisible) {
        return (
            <Container maxWidth="sm">
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '100vh',
                        gap: 3,
                    }}
                >
                    <CircularProgress size={60} />
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h2" gutterBottom>
                            Edifacts
                        </Typography>
                        <Typography variant="body1">
                            Preparing your personalized experience.
                        </Typography>
                    </Box>
                </Box>
            </Container>
        );
    }

    return children;
}
