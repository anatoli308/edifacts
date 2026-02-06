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
import AppOptionsPopover from '@/app/_components/layout/AppOptionsPopover';
import DrawerSessionItem from '@/app/_components/layout/DrawerSessionItem';
import { useLayoutConstants } from '@/app/_components/utils/Constants';
import Iconify from '@/app/_components/utils/Iconify';
import { useUser } from '@/app/_contexts/UserContext';
import { DRAWER_WIDTH } from '@/app/_components/utils/Constants';

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

function AppDesktopDrawer({ open, setOpen, analysisChats }) {
    const [anchorElAccount, setAnchorElAccount] = useState(null);
    const [sessionsExpanded, setSessionsExpanded] = useState(true);
    const { isAbove768 } = useLayoutConstants();
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
        <Box>
            <MiniDrawer
                variant="permanent"
                open={open}
                drawerwidth={DRAWER_WIDTH}
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
                                {open && <Image src="/logo/logo-color-no-bg.png" alt="edifacts logo" width={48} height={32} />}
                                {open && (
                                    <Typography variant="subtitle1" noWrap>
                                        EDIFACTS
                                    </Typography>
                                )}
                            </MuiLink>
                            <IconButton onClick={() => setOpen(!open)} sx={{ ml: 'auto' }}>
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
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {open && (
                            <>
                                {/* My Sessions Header - Fixed */}
                                <List sx={{ p: 1, pt: 0, flexShrink: 0 }}>
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
                                </List>

                                {/* Scrollable Sessions Container */}
                                <Box sx={{ flex: 1, overflowY: 'auto' }}>
                                    <List sx={{ p: 1, pt: 0 }}>
                                        {sessionsExpanded && analysisChats?.map((session, index) => (
                                            <DrawerSessionItem
                                                key={index}
                                                session={session}
                                            />
                                        ))}
                                    </List>
                                </Box>
                            </>
                        )}
                    </Box>

                    {/* Account Box */}
                    <Box sx={{ position: 'sticky', bottom: 0, p: 1, backgroundColor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
                        <List sx={{ p: 0 }}>
                            <ListItem sx={{ p: 0 }}>
                                <Tooltip title={!open ? user?.name || 'User' : ''} placement="right">
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
                                </Tooltip>
                            </ListItem>
                        </List>
                    </Box>

                </Box>
            </MiniDrawer>
            {/* Options Menu Popover with accound card */}
            <AppOptionsPopover
                updateAnchorEl={setAnchorElAccount}
                anchorElAccount={anchorElAccount}
            />
        </Box>
    );
}

export default AppDesktopDrawer;
