import {
    Box,
    Divider,
    List,
    ListItemButton,
    ListItemText,
    Drawer as MuiDrawer,
    Link as MuiLink,
    Stack
} from '@mui/material';
import Image from 'next/image';
import Link from 'next/link';

//app imports
import { useLayoutConstants } from '@/app/_components/utils/Constants';
import Iconify from '@/app/_components/utils/Iconify';
import { DRAWER_WIDTH } from '@/app/_components/utils/Constants';

function AppMobileDrawer({ onToggle, open }) {
    const { isAbove768 } = useLayoutConstants();
    const navItems = [
        { name: 'New Analysis', link: '/', icon: <Iconify icon="carbon:text-link-analysis" /> },
        {
            name: 'Search Session',
            icon: <Iconify icon="mdi:magnify" />,
            clickHandler: () => console.log("Search Session clicked")
        },
    ];

    return (
        <MuiDrawer
            variant="temporary"
            open={open}
            onClose={onToggle}
            ModalProps={{
                keepMounted: true, // Better open performance on mobile.
            }}
            sx={{
                display: isAbove768 ? 'none' : 'block',
                '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
            }}
        >
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
                        <Image src="/logo/logo-color-no-bg.png" alt="edifacts logo" width={48} height={32} />
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
        </MuiDrawer>
    );
}

export default AppMobileDrawer;
