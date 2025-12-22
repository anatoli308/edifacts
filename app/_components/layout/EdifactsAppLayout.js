"use client";

import {
    Avatar, Box,
    Button, Dialog,
    Divider,
    List, ListItem, ListItemButton,
    ListItemIcon,
    ListItemText,
    Paper,
    Popover, Typography
} from "@mui/material";

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

//app imports
import SettingsDialog from '@/app/_components/dialog/SettingsDialog';
import EdifactsDesktopDrawer from '@/app/_components/layout/EdifactsDesktopDrawer';
import EdifactsMobileDrawer from '@/app/_components/layout/EdifactsMobileDrawer';
import EdifactsAppBar from '@/app/_components/layout/EdifactsAppBar';
import Iconify from '@/app/_components/utils/Iconify';
import { useUser } from '@/app/_contexts/UserContext';

function DefaultAppBar({ children }) {
    const [mobileOpen, setMobileOpen] = React.useState(false);
    const [desktopOpen, setDesktopOpen] = React.useState(true);
    const [anchorElAccount, setAnchorElAccount] = React.useState(null);
    const [openLogoutDialog, setOpenLogoutDialog] = React.useState(false);
    const [openSettingsDialog, setOpenSettingsDialog] = React.useState(false);
    
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, logout } = useUser();

    // Handle settings dialog from URL
    React.useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) {
            setOpenSettingsDialog(true);
        }
    }, [searchParams]);

    const handleDrawerToggle = () => {
        setMobileOpen((prevState) => !prevState);
    };

    const handleDesktopDrawerToggle = () => {
        setDesktopOpen((prev) => !prev);
    };

    return (
        <Box sx={{ display: 'flex', height: "100%" }}>
            {/* Top App Bar */}
            <EdifactsAppBar
                open={desktopOpen}
                onToggle={handleDrawerToggle}
            />

            {/* Desktop mini variant drawer */}
            {user !== null ? <EdifactsDesktopDrawer
                open={desktopOpen}
                onToggle={handleDesktopDrawerToggle}
                onAccountClick={(e) => setAnchorElAccount(e.currentTarget)}
            /> : null}

            {/* Mobile temporary drawer */}
            <EdifactsMobileDrawer onToggle={handleDrawerToggle} open={mobileOpen} />

            {/* Account Popover Menu */}
            <Popover
                anchorEl={anchorElAccount}
                open={Boolean(anchorElAccount)}
                onClose={() => setAnchorElAccount(null)}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
            >
                <Paper sx={{ width: 320 }}>
                    {/* Account Card */}
                    <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ width: 48, height: 48 }}>{user?.name?.[0] || 'U'}</Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" noWrap>{user?.name || 'User'}</Typography>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ textTransform: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user?.email || 'account'}
                            </Typography>
                        </Box>
                    </Box>

                    <Divider />

                    {/* Options */}
                    <List sx={{ py: 0 }}>
                        <ListItem disablePadding>
                            <ListItemButton
                                onClick={() => {
                                    setAnchorElAccount(null);
                                    router.push('?tab=settings', { scroll: false });
                                }}>
                                <ListItemIcon sx={{ minWidth: 40 }}>
                                    <Iconify icon="mdi:settings" />
                                </ListItemIcon>
                                <ListItemText primary="Settings" />
                            </ListItemButton>
                        </ListItem>
                        <ListItem disablePadding>
                            <ListItemButton
                                onClick={() => {
                                    setAnchorElAccount(null);
                                    router.push('?tab=personalization', { scroll: false });
                                }}>
                                <ListItemIcon sx={{ minWidth: 40 }}>
                                    <Iconify icon="mdi:palette" />
                                </ListItemIcon>
                                <ListItemText primary="Personalize" />
                            </ListItemButton>
                        </ListItem>
                    </List>

                    <Divider />

                    {/* Logout */}
                    <List sx={{ py: 0 }}>
                        <ListItem disablePadding>
                            <ListItemButton
                                onClick={() => {
                                    setAnchorElAccount(null);
                                    setOpenLogoutDialog(true);
                                }}
                                sx={{ color: 'error.main' }}
                            >
                                <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                                    <Iconify icon="mdi:logout" />
                                </ListItemIcon>
                                <ListItemText primary="Logout" />
                            </ListItemButton>
                        </ListItem>
                    </List>
                </Paper>
            </Popover>

            {/* Logout Confirmation Dialog */}
            <Dialog
                open={openLogoutDialog}
                onClose={() => setOpenLogoutDialog(false)}
            >
                <Box sx={{ p: 3, minWidth: 350, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
                    <Box sx={{ width: 200, textAlign: 'center' }}>
                        <Typography variant="h4" sx={{ mb: 1 }}>Are you sure you want to logout?</Typography>
                        <Typography variant="h5" color="text.secondary" sx={{ mb: 3 }}>
                            Logout with {user?.email}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
                        <Button
                            variant="contained"
                            color="error"
                            onClick={() => {
                                setOpenLogoutDialog(false);
                                setAnchorElAccount(null);
                                logout?.();
                            }}
                        >
                            Logout
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={() => setOpenLogoutDialog(false)}
                        >
                            Cancel
                        </Button>
                    </Box>
                </Box>
            </Dialog>

            <Box component="main" sx={(theme) => ({
                width: '100%',
            })}>
                {children}
            </Box>

            {/* Settings Dialog */}
            <SettingsDialog
                open={openSettingsDialog}
                onClose={() => {
                    setOpenSettingsDialog(false);
                    router.push('?', { scroll: false });
                }}
            />
        </Box>
    );
}
export default DefaultAppBar;