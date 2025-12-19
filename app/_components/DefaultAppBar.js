"use client";

import MenuIcon from '@mui/icons-material/Menu';
import { Link as MuiLink } from "@mui/material";
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
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
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Image from 'next/image';

//app imports
import { useThemeConfig } from '@/app/theme/ThemeContext';
import { useUser } from '@/app/_contexts/UserContext';

const drawerWidth = 240;
const navItems = [{ name: 'Home', link: '/' }];
const settings = ['Account', 'Settings', 'Logout'];

function DefaultAppBar({ children }) {
    const [mobileOpen, setMobileOpen] = React.useState(false);
    const { themeBackground, handlers } = useThemeConfig();
    const { user } = useUser();

    const handleDrawerToggle = () => {
        setMobileOpen((prevState) => !prevState);
    };

    const [anchorElUser, setAnchorElUser] = React.useState(null);

    const handleOpenUserMenu = (event) => {
        setAnchorElUser(event.currentTarget);
    };

    const handleCloseUserMenu = () => {
        setAnchorElUser(null);
    };

    const drawer = (
        <Box sx={{ textAlign: 'center' }}>
            <Stack direction={"row"} spacing={1} justifyContent="center" alignItems="center" sx={{ my: 2 }}>
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
                    <MuiLink key={index} color="inherit" as={Link} href={item.link}
                        onClick={handleDrawerToggle} underline="none">
                        <ListItemButton sx={{ textAlign: 'center' }}>
                            <ListItemText primary={item.name} />
                        </ListItemButton>
                    </MuiLink>
                ))}
            </List>
        </Box>
    );

    const container = typeof window !== 'undefined' ? () => window.document.body : undefined;

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            <AppBar component="nav">
                <Toolbar>
                    <MuiLink href="/" as={Link} sx={{ display: { xs: 'none', sm: 'flex' }, mr: 1 }} >
                        <Image src="/logo/logo-color-no-bg.png" alt="edifacts logo" width={55} height={55} />
                    </MuiLink>
                    <MuiLink href="/" sx={{
                        mr: 2,
                        display: { xs: 'none', sm: 'flex' },
                    }} as={Link} underline='none' color='inherit'>
                        EDIFACTS
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

                    <Box sx={{ display: { xs: 'none', sm: 'block' }, flexGrow: 1 }}>
                        {navItems.map((item, index) => (
                            <MuiLink key={index} href={item.link}
                                as={Link}
                                color="inherit" underline='none'>
                                {item.name}
                            </MuiLink>
                        ))}
                    </Box>

                    <Stack direction="row" spacing={2} sx={{ mr: 2, ml: 2, flexGrow: 1 }}>
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
                    </Stack>

                    {user !== null ? <Box sx={{ flexGrow: 0 }}>
                        <Tooltip title="Open settings">
                            <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                                <Avatar alt="Remy Sharp" src="/static/images/avatar/2.jpg" />
                            </IconButton>
                        </Tooltip>
                        <Menu
                            sx={{ mt: '45px' }}
                            id="menu-appbar"
                            anchorEl={anchorElUser}
                            anchorOrigin={{
                                vertical: 'top',
                                horizontal: 'right',
                            }}
                            keepMounted
                            transformOrigin={{
                                vertical: 'top',
                                horizontal: 'right',
                            }}
                            open={Boolean(anchorElUser)}
                            onClose={handleCloseUserMenu}
                        >
                            {settings.map((setting) => (
                                <MenuItem key={setting} onClick={handleCloseUserMenu}>
                                    <Typography sx={{ textAlign: 'center' }}>{setting}</Typography>
                                </MenuItem>
                            ))}
                        </Menu>
                    </Box> : <Box sx={{ flexGrow: 0 }}>
                        <MuiLink href="/auth/login" as={Link} color="inherit" underline='none'>Login</MuiLink>
                    </Box>}
                </Toolbar>
            </AppBar>
            <Drawer
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
                {drawer}
            </Drawer>
            <Box component="main" sx={{ p: 3 }}>
                <Toolbar />
                {children}
            </Box>
        </Box>
    );
}
export default DefaultAppBar;