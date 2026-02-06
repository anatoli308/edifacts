import {
    Button,
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
    Typography
} from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';
import Iconify from '@/app/_components/utils/Iconify';

function DrawerSessionItem({ session }) {
    const [anchorEl, setAnchorEl] = useState(null);

    const handleOpenMenu = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setAnchorEl(null);
    };

    return (
        <>
            <ListItem
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
                        onClick={handleOpenMenu}
                        sx={{
                            opacity: 0,
                            pointerEvents: 'none',
                            transition: 'opacity 0.2s ease'
                        }}
                    >
                        <Iconify icon="mdi:dots-horizontal" />
                    </IconButton>
                }
            >
                <MuiLink 
                    color="inherit" 
                    as={Link}
                    sx={{ width: "100%" }}
                    href={`/a/${session._id}`} 
                    underline="none"
                >
                    <ListItemButton as={Button} color='inherit'>
                        <ListItemText 
                            primary={
                                <Typography noWrap>
                                    {session.name}
                                </Typography>
                            } 
                        />
                    </ListItemButton>
                </MuiLink>
            </ListItem>

            <Popover
                anchorEl={anchorEl}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleCloseMenu}
            >
                <List sx={{ p: 1 }}>
                    <ListItem disablePadding>
                        <ListItemButton
                            as={Button}
                            dense
                            color="inherit"
                            onClick={handleCloseMenu}
                        >
                            <ListItemIcon>
                                <Iconify icon="mdi:pencil-outline" />
                            </ListItemIcon>
                            <ListItemText primary="Rename" />
                        </ListItemButton>
                    </ListItem>
                    <Divider sx={{my:1}} />
                    <ListItem disablePadding>
                        <ListItemButton
                            as={Button}
                            dense
                            color="error"
                            onClick={handleCloseMenu}
                        >
                            <ListItemIcon>
                                <Iconify icon="mdi:delete-outline" />
                            </ListItemIcon>
                            <ListItemText primary="Delete" />
                        </ListItemButton>
                    </ListItem>
                </List>
            </Popover>
        </>
    );
}

export default DrawerSessionItem;
