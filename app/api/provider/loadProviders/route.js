import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createGuestUser, getApiKeysForUser } from '@/lib/auth';
import { userRepo } from '@/lib/db/repositories';

export async function GET(request) {
    try {
        const userId = request.headers.get('x-user-id');
        const token = request.headers.get('x-auth-token');
        const backgroundMode = request.headers.get('x-background-mode') || null;

        let user = await getAuthenticatedUser(userId, token);
        let issuedToken = null;

        if (!user) {
            user = await createGuestUser(backgroundMode);
            issuedToken = await userRepo.issueToken(user.id, 'web');
        }

        const providers = await getApiKeysForUser(user);
        return NextResponse.json({ providers, token: issuedToken });
    } catch (error) {
        console.error('Error loading providers:', error);
        return NextResponse.json({ error: 'Failed to load providers' }, { status: 500 });
    }
}
