'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/app/_contexts/UserContext';

/**
 * Redirects to specified route if user is not authenticated.
 * Client-side only hook.
 */
export function useProtectedRoute(redirectTo = '/') {
    const router = useRouter();
    const { user, isLoading } = useUser();

    useEffect(() => {
        // Warte bis User-Daten geladen sind
        if (!isLoading && !user) {
            router.push(redirectTo);
        }
    }, [user, isLoading, router, redirectTo]);
}