import {
    useMediaQuery,
    useTheme
} from '@mui/material';

const drawerWidth = 260;

export function useLayoutConstants() {
    const theme = useTheme();
    const isAbove768 = useMediaQuery('(min-width:768px)');
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
    return {
        drawerWidth,
        isAbove768,
        isSmallScreen,
        prefersDarkMode
    };
}
