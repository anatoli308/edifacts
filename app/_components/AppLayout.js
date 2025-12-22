"use client";

import {
    Box
} from "@mui/material";

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

//app imports
import SettingsDialog from '@/app/_components/dialogs/SettingsDialog';
import AppTopBar from '@/app/_components/layout/AppTopBar';
import AppDesktopDrawer from '@/app/_components/layout/AppDesktopDrawer';
import { useUser } from '@/app/_contexts/UserContext';

function AppLayout({ children }) {
    const [openSettingsDialog, setOpenSettingsDialog] = React.useState(false);

    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useUser();

    // Handle settings dialog from URL
    React.useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) {
            setOpenSettingsDialog(true);
        }
    }, [searchParams]);

    return (
        <Box sx={{ display: 'flex', height: "100%" }}>
            <AppTopBar
                open={true}
            />

            {/* Desktop left navigation drawer (with mini variant) */}
            {user !== null ? <AppDesktopDrawer
            /> : null}

            <Box component="main" sx={{ width: "100%" }}>
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
export default AppLayout;