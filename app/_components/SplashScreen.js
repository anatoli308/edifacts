'use client';

import { useEffect, useState } from 'react';
import { Box, CircularProgress, Container, Typography } from '@mui/material';

//app imports
import { useUser } from '@/app/_contexts/UserContext';
import { useSocket } from '@/app/_contexts/SocketContext';
import { useThemeConfig } from '@/app/_contexts/ThemeContext';

const MIN_LOADING_TIME = 1000; // in milliseconds

export default function SplashScreen({ children }) {
    const [isVisible, setIsVisible] = useState(true);
    const [startTime, setStartTime] = useState(Date.now());
    const { isLoading: userLoading, user } = useUser();
    const { isLoading: socketLoading } = useSocket();
    const { isLoaded: themeLoaded, splashTrigger } = useThemeConfig();

    useEffect(() => {
        setIsVisible(true);
        setStartTime(Date.now());
    }, [splashTrigger]);

    useEffect(() => {
        // Warte bis User & Socket geladen sind UND Mindestzeit vorbei ist
        if (!userLoading && !socketLoading && themeLoaded) {
            const elapsedTime = Date.now() - startTime;
            const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime);

            const timer = setTimeout(() => {
                setIsVisible(false);
            }, remainingTime);

            return () => clearTimeout(timer);
        }
    }, [userLoading, socketLoading, themeLoaded, startTime]);

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
                            {user && user.role === "USER" ? `Welcome back, ${user.name}!` : 'Preparing your personalized experience.'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                            {socketLoading ? 'Connecting to realtime service…' : 'Realtime service ready'}
                        </Typography>
                    </Box>
                </Box>
            </Container>
        );
    }

    return children;
}