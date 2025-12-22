"use client";

import {
    Box,
    Dialog,
    useMediaQuery,
    useTheme
} from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

//app imports
import SettingsDialogNavigation from '@/app/_components/dialog/SettingsDialogNavigation';
import SettingsDialogPersonalization from '@/app/_components/dialog/SettingsDialogPersonalization';
import SettingsDialogStart from '@/app/_components/dialog/SettingsDialogStart';

function SettingsDialog({ open, onClose }) {
    const [activeSection, setActiveSection] = useState('settings');
    const theme = useTheme();
    const router = useRouter();
    const searchParams = useSearchParams();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));

    // Handle URL search params changes
    useEffect(() => {
        if (open) {
            const section = searchParams.get('tab');
            if (section) {
                console.log("SettingsDialog - tab param:", section);
                setActiveSection(section);
            } else {
                handleClose();
            }
        }
    }, [open, searchParams]);

    const handleSectionChange = (section) => {
        setActiveSection(section);
        router.push(`?tab=${section}`, { scroll: false });
    };

    const handleClose = () => {
        router.push('?', { scroll: false });
        onClose();
    };

    const renderContent = () => {
        switch (activeSection) {
            case 'personalization':
                return <SettingsDialogPersonalization />;
            case 'settings':
            default:
                return <SettingsDialogStart />;
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="md"
            fullWidth
        >
            <Box sx={{
                display: 'flex',
                height: '600px',
                flexDirection: isSmallScreen ? 'column' : 'row',
                position: 'relative'
            }}>
                <SettingsDialogNavigation
                    activeSection={activeSection}
                    handleSectionChange={handleSectionChange}
                    handleClose={handleClose}
                />
                <Box sx={{ flex: 1, overflow: 'auto' }}>
                    {renderContent()}
                </Box>
            </Box>
        </Dialog>
    );
}

export default SettingsDialog;
