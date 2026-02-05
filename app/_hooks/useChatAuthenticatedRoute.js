// hooks/useChatAuthenticatedRoute.js

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/app/_contexts/UserContext';
import { useSnackbar } from '@/app/_contexts/SnackbarContext';

export function useChatAuthenticatedRoute(chat) {
    const router = useRouter();
    const { user, loading } = useUser();
    const { pushSnackbarMessage } = useSnackbar();

    useEffect(() => {
        if (loading) return; // Wait for user load

        // 1. Not authenticated
        if (!user || !chat || chat.creatorId !== user._id) {
            pushSnackbarMessage('Session does not exist.', 'error');
            router.push('/');
            return;
        }

        // All good
    }, [user, chat, loading, router]);

    return { isAuthorized: !!user && !!chat && chat.creatorId === user._id, loading };
}