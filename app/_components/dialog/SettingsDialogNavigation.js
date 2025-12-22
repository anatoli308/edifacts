"use client";

import {
    Box,
    List,
    ListItemButton,
    ListItemText,
    Paper,
    Tab,
    Tabs,
    Typography,
} from '@mui/material';

//app imports
import { useLayoutConstants } from '@/app/_components/utils/Constants';
import Iconify from '@/app/_components/utils/Iconify';

function SettingsDialogNavigation({ activeSection, handleSectionChange, handleClose }) {
    const navigationItems = [
        { id: 'settings', label: 'Settings', icon: '⚙️' },
        { id: 'personalization', label: 'Personalize', icon: '🎨' }
    ];

    const { isSmallScreen } = useLayoutConstants();

    if (isSmallScreen) {
        return (
            <Paper
                elevation={0}
                sx={{
                    borderBottom: 1,
                    borderColor: 'divider',
                    backgroundColor: 'background.default'
                }}
            >
                <Tabs
                    value={activeSection}
                    onChange={(event, newValue) => handleSectionChange(newValue)}
                    variant="fullWidth"
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
            </Paper>
        );
    }
    return (
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ px: 2, py: 1, fontWeight: 'bold', color: 'text.secondary' }}>
                    MENU
                </Typography>
                <Iconify
                    onClick={() => handleClose()}
                    icon="mdi:close" sx={{ fontSize: 20, color: 'text.secondary', cursor: "pointer" }} />
            </Box>
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
    );
}

export default SettingsDialogNavigation;