"use client";

import {
    Box,
    Dialog,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    Paper,
    Tab,
    Tabs,
    ToggleButton, ToggleButtonGroup,
    Typography,
    useMediaQuery, useTheme
} from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

//app imports
import Iconify from '@/app/_components/Iconify';
import { useThemeConfig } from '@/app/_contexts/ThemeContext';

function SettingsDialog({ open, onClose }) {
    const { themeBackground, handlers } = useThemeConfig();
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

    const navigationItems = [
        { id: 'settings', label: 'Settings', icon: '⚙️' },
        { id: 'personalization', label: 'Personalize', icon: '🎨' }
    ];

    const renderContent = () => {
        switch (activeSection) {
            case 'personalization':
                return (
                    <Box sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Personalization
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                            Customize your experience
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                Theme, layout, and other personalization options coming soon...
                            </Typography>
                        </Box>
                    </Box>
                );
            case 'settings':
            default:
                return (
                    <Box sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Settings
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                            Configure your preferences
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                General settings and preferences coming soon...
                            </Typography>
                        </Box>
                        <ToggleButtonGroup
                            size="small"
                            color="primary"
                            value={themeBackground}
                            exclusive
                            onChange={(_, value) => value && handlers.updateBackground(value)}>
                            <ToggleButton value="white">Light</ToggleButton>
                            <ToggleButton value="#1a2a3b">Dim</ToggleButton>
                            <ToggleButton value="black">Dark</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                );
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
                {/* Navigation - Vertical on Large Screens, Horizontal on Small Screens */}
                {isSmallScreen ? (
                    <Paper
                        elevation={0}
                        sx={{
                            borderBottom: 1,
                            borderColor: 'divider',
                            backgroundColor: 'background.default',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            pl: 2
                        }}
                    >
                        <Tabs
                            value={activeSection}
                            onChange={(event, newValue) => handleSectionChange(newValue)}
                            variant="fullWidth"
                            sx={{ flex: 1 }}
                        >
                            {navigationItems.map((item) => (
                                <Tab
                                    key={item.id}
                                    value={item.id}
                                    label={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <span>{item.icon}</span>
                                            <span>{item.label}</span>
                                        </Box>
                                    }
                                />
                            ))}
                        </Tabs>
                        <IconButton
                            onClick={handleClose}
                            size="small"
                        >
                            <Iconify icon="mdi:close" />
                        </IconButton>
                    </Paper>
                ) : (
                    <>
                        {/* Close Button for Large Screens */}
                        <IconButton
                            onClick={handleClose}
                            sx={{
                                position: 'absolute',
                                right: 8,
                                top: 8,
                                zIndex: 1
                            }}
                        >
                            <Iconify icon="mdi:close" />
                        </IconButton>
                        <Paper
                            elevation={0}
                            sx={{
                                width: '220px',
                                borderRight: 1,
                                borderColor: 'divider',
                                p: 2,
                                backgroundColor: 'background.default'
                            }}
                        >
                            <Typography variant="subtitle2" sx={{ px: 2, py: 1, fontWeight: 'bold', color: 'text.secondary' }}>
                                MENU
                            </Typography>
                            <List sx={{ p: 0 }}>
                                {navigationItems.map((item) => (
                                    <ListItemButton
                                        key={item.id}
                                        selected={activeSection === item.id}
                                        onClick={() => handleSectionChange(item.id)}
                                        sx={{
                                            mb: 1,
                                            borderRadius: 1,
                                            '&.Mui-selected': {
                                                backgroundColor: 'action.selected'
                                            }
                                        }}
                                    >
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <span>{item.icon}</span>
                                                    <span>{item.label}</span>
                                                </Box>
                                            }
                                        />
                                    </ListItemButton>
                                ))}
                            </List>
                        </Paper>
                    </>
                )}

                {/* Right Content */}
                <Box sx={{ flex: 1, overflow: 'auto' }}>
                    {renderContent()}
                </Box>
            </Box>
        </Dialog>
    );
}

export default SettingsDialog;
