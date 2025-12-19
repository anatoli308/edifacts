'use client';

import { useEffect, useState } from 'react';
import { Box, CircularProgress, Container, Typography } from '@mui/material';

//app imports
import { useUser } from '@/app/_contexts/UserContext';
import { useThemeConfig } from '@/app/theme/ThemeContext';

const MIN_LOADING_TIME = 1500; // in milliseconds

export default function SplashScreen({ children }) {
    const [isVisible, setIsVisible] = useState(true);
    const [startTime] = useState(Date.now());
    const { isLoading: userLoading, user } = useUser();
    const { isLoaded: themeLoaded, handlers } = useThemeConfig();

    // Theme von User anwenden
    useEffect(() => {
        if (user && user.theme) {
            handlers.updateFontColor(user.theme.fontColor);
            handlers.updateBackground(user.theme.backgroundMode);
            handlers.updateFontSize(user.theme.fontSize);
        }
    }, [user]);

    useEffect(() => {
        // Warte bis User geladen ist UND Mindestzeit vorbei ist
        if (!userLoading && themeLoaded) {
            const elapsedTime = Date.now() - startTime;
            const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime);

            const timer = setTimeout(() => {
                setIsVisible(false);
            }, remainingTime);

            return () => clearTimeout(timer);
        }
    }, [userLoading, themeLoaded, startTime]);

    if (isVisible) {
        return (
            <Container maxWidth="sm">
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: '100vh',
                    gap: 3,
                }}>
                    <CircularProgress size={60} />
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h2" gutterBottom>
                            EDIFACTS
                        </Typography>
                        <Typography variant="body1">
                            {user ? `Welcome back, ${user.name}!` : 'Preparing your personalized experience.'}
                        </Typography>
                    </Box>
                </Box>
            </Container>
        );
    }

    return children;
}