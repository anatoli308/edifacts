'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/app/_contexts/UserContext';

/**
 * Redirects authenticated users away from guest-only routes (e.g. login/register).
 * Client-side only. Keeps server pages as Server Components with metadata
 * when used from a client wrapper.
 *
 * Usage in a client page or client wrapper:
 *   useAlreadyAuthenticatedRoute('/');
 */
export function useAlreadyAuthenticatedRoute(redirectTo = '/') {
    const router = useRouter();
    const { user, isLoading } = useUser();
    const redirectedRef = useRef(false);

    useEffect(() => {
        if (redirectedRef.current) return;
        if (!isLoading && user) {
            redirectedRef.current = true;
            router.replace(redirectTo);
        }
    }, [user, isLoading, router, redirectTo]);
}

