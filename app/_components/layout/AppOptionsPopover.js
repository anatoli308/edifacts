import * as React from 'react';

import {
    Avatar,
    Box,
    Divider,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Paper,
    Popover,
    Typography,
    Dialog,
    Button
} from '@mui/material';
import { useRouter } from 'next/navigation';

//app imports
import Iconify from '@/app/_components/utils/Iconify';
import { useUser } from '@/app/_contexts/UserContext';
import { useThemeConfig } from '@/app/_contexts/ThemeContext';

function AppOptionsPopover({
    anchorElAccount,
    updateAnchorEl
}) {

    const { user, logout } = useUser();
    const router = useRouter();
    const { restartSplashscreen } = useThemeConfig();
    const [openLogoutDialog, setOpenLogoutDialog] = React.useState(false);

    const open = Boolean(anchorElAccount);

    const handleClickSettings = () => {
        handleClickClose();
        router.push('?tab=settings', { scroll: false });
    };

    const handleClickPersonalize = () => {
        handleClickClose();
        router.push('?tab=personalization', { scroll: false });
    };

    const handleClickLogout = () => {
        handleClickClose();
        setOpenLogoutDialog(true);
    };

    const handleClickClose = () => {
        updateAnchorEl(null);
    }

    return (
        <Box>
            <Popover
                anchorEl={anchorElAccount}
                open={open}
                onClose={handleClickClose}
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

                    <List sx={{ py: 0 }}>
                        <ListItem disablePadding>
                            <ListItemButton onClick={handleClickSettings}>
                                <ListItemIcon sx={{ minWidth: 40 }}>
                                    <Iconify icon="mdi:settings" />
                                </ListItemIcon>
                                <ListItemText primary="Settings" />
                            </ListItemButton>
                        </ListItem>
                        <ListItem disablePadding>
                            <ListItemButton onClick={handleClickPersonalize}>
                                <ListItemIcon sx={{ minWidth: 40 }}>
                                    <Iconify icon="mdi:palette" />
                                </ListItemIcon>
                                <ListItemText primary="Personalize" />
                            </ListItemButton>
                        </ListItem>
                    </List>

                    <Divider />

                    <List sx={{ py: 0 }}>
                        <ListItem disablePadding>
                            <ListItemButton onClick={handleClickLogout} sx={{ color: 'error.main' }}>
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
                                handleClickClose();
                                logout?.();
                                restartSplashscreen();
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
        </Box>
    );
}

export default AppOptionsPopover;
