import {
    AppBar,
    Box,
    Button,
    Chip,
    Divider,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    ListSubheader,
    Link as MuiLink,
    Popover,
    Stack,
    Toolbar,
    Tooltip,
    Typography
} from "@mui/material";
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

//app imports
import { DRAWER_WIDTH, useLayoutConstants } from '@/app/_components/utils/Constants';
import Iconify from '@/app/_components/utils/Iconify';
import { useSocket } from '@/app/_contexts/SocketContext';
import { useUser } from '@/app/_contexts/UserContext';
import AppMobileDrawer from '@/app/_components/layout/AppMobileDrawer';

function AppTopBar({ open }) {

    const [mobileOpen, setMobileOpen] = useState(false);
    const [anchorElUser, setAnchorElUser] = useState(null);
    const router = useRouter();
    const { user } = useUser();
    const { isConnected, isLoading } = useSocket();
    const { isAbove768 } = useLayoutConstants();

    const settings = [
        { name: 'Pin Session', icon: <Iconify icon="iconoir:pin" />, color: "inherit" },
        { name: 'Delete', icon: <Iconify icon="mdi:delete-outline" />, color: "error" },
    ];

    const handleOpenUserMenu = (event) => {
        setAnchorElUser(event.currentTarget);
    };

    const handleCloseUserMenu = () => {
        setAnchorElUser(null);
    };

    const handleDrawerToggle = () => {
        setMobileOpen((prevState) => !prevState);
    };

    return (
        <AppBar component="nav" sx={{ background: 'transparent', boxShadow: 'none' }}>
            <Toolbar>
                <MuiLink href="/" as={Link}
                    sx={{
                        display: isAbove768 ? 'flex' : 'none', mr: 1,
                        width: (user !== null && user.role === "USER") && open ? (DRAWER_WIDTH - 20) : 45
                    }} >
                    <Image src="/logo/logo-color-no-bg.png" alt="edifacts logo" width={100} height={55} />
                </MuiLink>

                <IconButton
                    color="inherit"
                    aria-label="open drawer"
                    edge="start"
                    onClick={handleDrawerToggle}
                    sx={{ mr: 2, display: isAbove768 ? 'none' : 'block' }}
                >
                    <Iconify icon="mdi:menu" />
                </IconButton>

                <Stack direction="row" spacing={1} sx={{ flexGrow: 1, alignItems: 'center' }}>
                    <Tooltip
                        title={isLoading ? "Worker connecting..." : isConnected ? "Worker ready" : "Worker disconnected"}>
                        <Chip
                            label={
                                <Typography color="textPrimary">
                                    {isLoading ? "⟳" : isConnected ? "✓" : "✕"}
                                </Typography>
                            }
                            color={isLoading ? "warning" : isConnected ? "success" : "error"}
                            size="small"
                        />
                    </Tooltip>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, }}>
                        <Tooltip title="Session Settings">
                            <IconButton
                                size="small"
                                onClick={() => router.push('?tab=settings', { scroll: false })}
                                sx={{ ml: 'auto' }}
                            >
                                {'⚙️'}
                            </IconButton>
                        </Tooltip>
                        <Typography onClick={() => router.push('?tab=settings', { scroll: false })}
                            variant="h6" color='text.primary' sx={{
                                "&:hover": {
                                    background: "linear-gradient(270deg, #ff6a00, #ee0979, #00f0ff)",
                                    backgroundSize: "600% 600%",
                                    animation: "gradientShift 3s ease infinite",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                },
                                "@keyframes gradientShift": {
                                    "0%": { backgroundPosition: "0% 50%" },
                                    "50%": { backgroundPosition: "100% 50%" },
                                    "100%": { backgroundPosition: "0% 50%" },
                                }
                            }}>
                            EDIFACTS Assistant</Typography>
                    </Box>

                </Stack>

                {user !== null && user.role === "USER" ? <Box sx={{ flexGrow: 0 }}>
                    <Button onClick={handleOpenUserMenu} color="inherit" size='small'>
                        <Typography variant="caption" color="textPrimary" sx={{ display: "flex" }}>
                            <Iconify icon="mdi:dots-horizontal" />
                        </Typography>
                    </Button>
                    <Popover
                        id="menu-appbar"
                        anchorEl={anchorElUser}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'right',
                        }}
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                        }}
                        open={Boolean(anchorElUser)}
                        onClose={handleCloseUserMenu}
                    >
                        <List sx={{ p: 1 }}>
                            <Divider />
                            <ListSubheader><ListItemButton dense disabled></ListItemButton></ListSubheader>
                            {settings.map((setting, index) => (
                                <ListItem disablePadding key={index}>
                                    <ListItemButton
                                        as={Button}
                                        dense
                                        color={setting.color || "inherit"}
                                        onClick={setting.clickHandler || handleCloseUserMenu}>
                                        <ListItemIcon>
                                            {setting.icon}
                                        </ListItemIcon>
                                        <ListItemText primary={setting.name} />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    </Popover>
                </Box> : <Box sx={{ flexGrow: 0, gap: 1, display: 'flex' }}>
                    <MuiLink href="/auth/login" as={Link} color="text.primary" underline='none'>Login</MuiLink>
                    <MuiLink href="/auth/register" as={Link} color="text.primary" underline='none'>Register</MuiLink>
                </Box>}
            </Toolbar>

            {/* Mobile drawer */}
            <AppMobileDrawer onToggle={handleDrawerToggle} open={mobileOpen} />

        </AppBar>
    );
}

export default AppTopBar;
