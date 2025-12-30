import {
    useMediaQuery,
    useTheme
} from '@mui/material';

export const IS_PROD = process.env.NODE_ENV === 'production';
export const WEB_SOCKET_URL = IS_PROD ? 'wss://edifacts.com' : 'ws://localhost:3010';

export const DRAWER_WIDTH = 260;

export const AUTH_COOKIE_NAME = 'authToken';
export const AUTH_COOKIE_EXPIRY_SECONDS = (7 * 24 * 60 * 60); // 7 days in seconds

export function readTokenFromCookie() {
  try {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie.split(';').map(s => s.trim());
    for (const c of cookies) {
      if (c.startsWith(`${AUTH_COOKIE_NAME}=`)) {
        return decodeURIComponent(c.substring(`${AUTH_COOKIE_NAME}=`.length));
      }
    }
    return null;
  } catch {
    return null;
  }
}

//hooked constants for layout
export function useLayoutConstants() {
    const theme = useTheme();
    const isAbove768 = useMediaQuery('(min-width:768px)');
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
    return {
        isAbove768,
        isSmallScreen,
        prefersDarkMode
    };
}
