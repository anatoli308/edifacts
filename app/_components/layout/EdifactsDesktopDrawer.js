"use client";

import {
    Avatar,
    Box,
    Button,
    Divider,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Drawer as MuiDrawer,
    Link as MuiLink,
    Tooltip,
    Typography
} from '@mui/material';
import { styled } from '@mui/material/styles';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

//app imports
import { useLayoutConstants } from '@/app/_components/utils/Constants';
import Iconify from '@/app/_components/utils/Iconify';
import { useUser } from '@/app/_contexts/UserContext';

const DrawerHeader = styled('div')(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: theme.spacing(0, 1),
    ...theme.mixins.toolbar,
}));

// Mini variant drawer mixins
const openedMixin = (theme, drawerWidth) => ({
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

const MiniDrawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' && prop !== 'drawerwidth' })(({
    theme, open, drawerwidth,
}) => ({
    width: drawerwidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open && {
        ...openedMixin(theme, drawerwidth),
        '& .MuiDrawer-paper': openedMixin(theme, drawerwidth),
    }),
    ...(!open && {
        ...closedMixin(theme),
        '& .MuiDrawer-paper': closedMixin(theme),
    }),
}));

function EdifactsDesktopDrawer({ open, onToggle, onAccountClick }) {
    const [sessionsExpanded, setSessionsExpanded] = useState(true);
    const { isAbove768, drawerWidth } = useLayoutConstants();
    const { user } = useUser();

    const navItems = [
        { name: 'New Analysis', link: '/', icon: <Iconify icon="carbon:text-link-analysis" /> },
        {
            name: 'Search Session',
            icon: <Iconify icon="mdi:magnify" />,
            clickHandler: () => console.log("Search Session clicked")
        },
    ];

    return (
        <MiniDrawer
            variant="permanent"
            open={open}
            drawerwidth={drawerWidth}
            sx={{ display: isAbove768 ? 'block' : 'none' }}
        >
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
                            {open && <Image src="/logo/logo-color-no-bg.png" alt="edifacts logo" width={30} height={30} />}
                            {open && (
                                <Typography variant="subtitle1" noWrap>
                                    EDIFACTS
                                </Typography>
                            )}
                        </MuiLink>
                        <IconButton onClick={onToggle} sx={{ ml: 'auto' }}>
                            {open ? <Iconify icon="mdi:chevron-right" /> : <Iconify icon="mdi:chevron-left" />}
                        </IconButton>
                    </DrawerHeader>
                    <Divider />
                    <List sx={{ p: 1 }}>
                        {navItems.map((item, index) => (
                            <Tooltip key={index} title={!open ? item.name : ''} placement="right">
                                <MuiLink color="inherit" as={item.link ? Link : Box}
                                    onClick={item.clickHandler ? item.clickHandler : undefined}
                                    href={item.link ? item.link : undefined} underline="none">
                                    <ListItemButton as={Button} color='inherit'>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                                            {item.icon}
                                            {open && <ListItemText primary={item.name} />}
                                        </Box>
                                    </ListItemButton>
                                </MuiLink>
                            </Tooltip>
                        ))}
                    </List>
                </Box>

                {/* Sessions List */}
                <Box sx={{ flex: 1, overflowY: 'auto' }}>
                    {open && <List sx={{ p: 1, pt: 0 }}>
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
                            <Iconify
                                className="session-chevron"
                                sx={{
                                    fontSize: 16,
                                    ml: 'auto',
                                    opacity: 0,
                                    transition: 'transform 0.3s, opacity 0.3s',
                                    transform: sessionsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)'
                                }}
                                icon="mdi:chevron-down"
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
                                        <Iconify icon="mdi:dots-horizontal" />
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

                {/* Account Box */}
                <Box sx={{ position: 'sticky', bottom: 0, p: 1 }}>
                    <List sx={{ p: 0 }}>
                        <ListItem sx={{ p: 0 }}>
                            <Tooltip title={!open ? user?.name || 'User' : ''} placement="right">
                                <ListItemButton
                                    as={Button}
                                    color='inherit'
                                    onClick={onAccountClick}
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
                            </Tooltip>
                        </ListItem>
                    </List>
                </Box>
            </Box>
        </MiniDrawer>
    );
}

export default EdifactsDesktopDrawer;
