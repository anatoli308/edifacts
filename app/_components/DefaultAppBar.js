"use client";

import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import HomeIcon from '@mui/icons-material/Home';
import { styled, useTheme } from '@mui/material/styles';
import { Button, Link as MuiLink, ListSubheader } from "@mui/material";
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Divider from '@mui/material/Divider';
import MuiDrawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Popover from '@mui/material/Popover';
import Paper from '@mui/material/Paper';
import ListItem from '@mui/material/ListItem';
import Tooltip from '@mui/material/Tooltip';
import Image from 'next/image';
import { Chip, ListItemIcon, Dialog, DialogContent, CloseIcon } from '@mui/material';
import AddchartIcon from '@mui/icons-material/Addchart';
import SearchIcon from '@mui/icons-material/Search';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import PaletteIcon from '@mui/icons-material/Palette';
import LogoutIcon from '@mui/icons-material/Logout';
import { useRouter, useSearchParams } from 'next/navigation';
//app imports
import { useThemeConfig } from '@/app/_contexts/ThemeContext';
import { useUser } from '@/app/_contexts/UserContext';
import { useSocket } from '@/app/_contexts/SocketContext';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import CommentIcon from '@mui/icons-material/Comment';
import SettingsDialog from '@/app/_components/SettingsDialog';

const drawerWidth = 240;
const navItems = [{ name: 'New Analysis', link: '/', icon: <AddchartIcon /> },
{ name: 'Search Session', icon: <SearchIcon />, clickHandler: () => handleSearchSessionClick() },];

const handleSearchSessionClick = () => {
    // Implement your search session logic here
    console.log("Search Session clicked");
}

// Mini variant drawer mixins
const openedMixin = (theme) => ({
    width: drawerWidth,
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
    }),
    overflowX: 'hidden',
});

const closedMixin = (theme) => ({
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    overflowX: 'hidden',
    width: `calc(${theme.spacing(7)} + 1px)`,
    [theme.breakpoints.up('sm')]: {
        width: `calc(${theme.spacing(8)} + 1px)`,
    },
});

const DrawerHeader = styled('div')(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: theme.spacing(0, 1),
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
}));

const MiniDrawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(({
    theme, open,
}) => ({
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open && {
        ...openedMixin(theme),
        '& .MuiDrawer-paper': openedMixin(theme),
    }),
    ...(!open && {
        ...closedMixin(theme),
        '& .MuiDrawer-paper': closedMixin(theme),
    }),
}));

function DefaultAppBar({ children }) {
    const [mobileOpen, setMobileOpen] = React.useState(false);
    const [desktopOpen, setDesktopOpen] = React.useState(true);
    const [sessionsExpanded, setSessionsExpanded] = React.useState(true);
    const [anchorElAccount, setAnchorElAccount] = React.useState(null);
    const [openLogoutDialog, setOpenLogoutDialog] = React.useState(false);
    const [openSettingsDialog, setOpenSettingsDialog] = React.useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, logout } = useUser();
    const { isConnected, isLoading } = useSocket();

    // Handle settings dialog from URL
    React.useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) {
            setOpenSettingsDialog(true);
        }
    }, [searchParams]);

    const settings = [{ name: 'Pin Analysis', icon: <PushPinOutlinedIcon />, color: "inherit" },
    { name: 'Delete', icon: <DeleteOutlineOutlinedIcon />, color: "error" },];

    const handleDrawerToggle = () => {
        setMobileOpen((prevState) => !prevState);
    };

    const handleDesktopDrawerToggle = () => {
        setDesktopOpen((prev) => !prev);
    };

    const [anchorElUser, setAnchorElUser] = React.useState(null);

    const handleOpenUserMenu = (event) => {
        setAnchorElUser(event.currentTarget);
    };

    const handleCloseUserMenu = () => {
        setAnchorElUser(null);
    };

    const mobileDrawerContent = (
        <Box sx={{ textAlign: 'center' }}>
            <Stack direction={"row"} spacing={1} justifyContent="center" alignItems="center" sx={{
                my: 2,
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
                <MuiLink href="/" as={Link} sx={{ display: { xs: 'flex' }, mr: 1 }} >
                    <Image src="/logo/logo-color-no-bg.png" alt="edifacts logo" width={25} height={25} />
                </MuiLink>
                <MuiLink href="/" as={Link} underline='none' color='inherit'>
                    EDIFACTS
                </MuiLink>
            </Stack>
            <Divider />
            <List>
                {navItems.map((item, index) => (
                    <MuiLink key={index} color="inherit" as={item.link ? Link : Box}
                        onClick={item.clickHandler ? item.clickHandler : undefined}
                        href={item.link ? item.link : undefined} underline="none">
                        <ListItemButton sx={{ textAlign: 'center' }}>
                            <ListItemText primary={item.name} />
                        </ListItemButton>
                    </MuiLink>
                ))}
            </List>
        </Box>
    );

    const desktopDrawerContent = (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'background.paper' }}>
                <DrawerHeader sx={{
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
                    <MuiLink href="/" as={Link} underline='none' color='inherit' sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {desktopOpen && <Image src="/logo/logo-color-no-bg.png" alt="edifacts logo" width={30} height={30} />}
                        {desktopOpen && (
                            <Typography variant="subtitle1" noWrap>
                                EDIFACTS
                            </Typography>
                        )}
                    </MuiLink>
                    <IconButton onClick={handleDesktopDrawerToggle} sx={{ ml: 'auto' }}>
                        {desktopOpen ? <ChevronRightIcon /> : <ChevronLeftIcon />}
                    </IconButton>
                </DrawerHeader>
                <Divider />
                <List sx={{ p: 1 }}>
                    {navItems.map((item, index) => (
                        <MuiLink key={index} color="inherit" as={item.link ? Link : Box}
                            onClick={item.clickHandler ? item.clickHandler : undefined}
                            href={item.link ? item.link : undefined} underline="none">
                            <ListItemButton as={Button} color='inherit'>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                                    {item.icon}
                                    {desktopOpen && <ListItemText primary={item.name} />}
                                </Box>
                            </ListItemButton>
                        </MuiLink>
                    ))}
                </List>
            </Box>

            <Box sx={{
                flex: 1, overflowY: 'auto',
                //scrollbarWidth: 'none',   // Firefox

                // Chrome, Edge, Safari
                //'&::-webkit-scrollbar': {
                //    display: 'none',
                //},
            }}>
                {desktopOpen && <List sx={{ p: 1, pt: 0 }}>
                    <ListItem
                        onClick={() => setSessionsExpanded(!sessionsExpanded)}
                        sx={{
                            cursor: "pointer",
                            mt: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            '&:hover .session-chevron': {
                                opacity: 1
                            }
                        }}
                    >
                        <Typography variant="caption" color='text.disabled'>
                            My Sessions
                        </Typography>
                        <KeyboardArrowDownIcon
                            className="session-chevron"
                            sx={{
                                fontSize: 16,
                                ml: 'auto',
                                opacity: 0,
                                transition: 'transform 0.3s, opacity 0.3s',
                                transform: sessionsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)'
                            }}
                        />
                    </ListItem>
                    {sessionsExpanded && [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5,].map((text, index) => (
                        <ListItem
                            key={index}
                            disablePadding
                            sx={{
                                '&:hover .session-item-more': {
                                    opacity: 1,
                                    pointerEvents: 'auto'
                                }
                            }}
                            secondaryAction={
                                <IconButton
                                    edge="end"
                                    aria-label="more"
                                    size="small"
                                    className="session-item-more"
                                    sx={{
                                        opacity: 0,
                                        pointerEvents: 'none',
                                        transition: 'opacity 0.2s ease'
                                    }}
                                >
                                    <MoreHorizIcon />
                                </IconButton>
                            }>
                            <MuiLink color="inherit" as={Link}
                                sx={{ width: "100%" }}
                                href={"/a/abc-def-ged"} underline="none">
                                <ListItemButton as={Button} color='inherit'>
                                    <ListItemText primary={<Typography noWrap>Item long long long {text}</Typography>} />
                                </ListItemButton>
                            </MuiLink>
                        </ListItem>
                    ))}
                </List>}
            </Box>

            {desktopOpen && <Box sx={{ position: 'sticky', bottom: 0, p: 1 }}>
                <List sx={{ p: 0 }}>
                    <ListItem sx={{ p: 0 }}>
                        <ListItemButton
                            as={Button}
                            color='inherit'
                            onClick={(e) => setAnchorElAccount(e.currentTarget)}
                            sx={{ px: 1, display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                            <Avatar sx={{ width: 32, height: 32 }}>{user?.name?.[0] || 'U'}</Avatar>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography textTransform={"none"} variant="body2" noWrap>{user?.name || 'User'}</Typography>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ textTransform: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {user?.email || 'account'}
                                </Typography>
                            </Box>
                        </ListItemButton>
                    </ListItem>
                </List>
            </Box>}
        </Box>
    );

    const container = typeof window !== 'undefined' ? () => window.document.body : undefined;

    return (
        <Box sx={{ display: 'flex', height: "100%" }}>
            <CssBaseline />
            <AppBar component="nav" sx={{ background: 'transparent', boxShadow: 'none' }}>
                <Toolbar>
                    <MuiLink href="/" as={Link} sx={{ display: { xs: 'none', sm: 'flex' }, mr: 1 }} >
                        <Image src="/logo/logo-color-no-bg.png" alt="edifacts logo" width={85} height={55} />
                    </MuiLink>

                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        edge="start"
                        onClick={handleDrawerToggle}
                        sx={{ mr: 2, display: { sm: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>

                    <Stack direction="row" spacing={2} sx={{ mr: 2, ml: 2, flexGrow: 1, alignItems: 'center' }}>
                        <Tooltip title={isLoading ? "Worker connecting..." : isConnected ? "Worker ready" : "Worker disconnected"}>
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
                            <Typography variant="h6" color='text.primary' sx={{
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

                    {user !== null ? <Box sx={{ flexGrow: 0 }}>
                        <Button onClick={handleOpenUserMenu} color="inherit" size='small'>
                            <Typography variant="caption" color="textPrimary" sx={{ display: "flex" }}>
                                <MoreHorizIcon />
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
            </AppBar>

            {/* Desktop mini variant drawer */}
            {user !== null ? <MiniDrawer
                variant="permanent"
                open={desktopOpen}
                sx={{ display: { xs: 'none', sm: 'block' } }}
            >
                {desktopDrawerContent}
            </MiniDrawer> : null}

            {/* Mobile temporary drawer */}
            <MuiDrawer
                container={container}
                variant="temporary"
                open={mobileOpen}
                onClose={handleDrawerToggle}
                ModalProps={{
                    keepMounted: true, // Better open performance on mobile.
                }}
                sx={{
                    display: { xs: 'block', sm: 'none' },
                    '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                }}
            >
                {mobileDrawerContent}
            </MuiDrawer>

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
                                    <SettingsIcon />
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
                                    <PaletteIcon />
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
                                    <LogoutIcon />
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