'use client';


import ThemeProvider from '@/app/theme/index';
import { UserProvider } from '@/app/_contexts/UserContext';
import { SocketProvider } from '@/app/_contexts/SocketContext';
import { SnackbarProvider } from '@/app/_contexts/SnackbarContext';

export default function Providers({ children }) {
    return (
        <UserProvider>
            <SocketProvider>
                <ThemeProvider>
                    <SnackbarProvider>
                        {children}
                    </SnackbarProvider>
                </ThemeProvider>
            </SocketProvider>
        </UserProvider>
    );
}