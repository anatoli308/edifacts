import { NextResponse } from 'next/server';
import { getAuthenticatedUser , getApiKeysForUser } from '@/lib/auth';

export async function GET(request) {
    try {
        const userId = request.headers.get('x-user-id');
        const token = request.headers.get('x-auth-token');
        let user = await getAuthenticatedUser(userId, token);

        if (!user) {
            user = await createGuestUser(backgroundMode);
        }

        const isNewUser = user.isNew;
        if (isNewUser) {
            await user.save();
            await user.generateAuthToken('web');
        }

        const providers = await getApiKeysForUser(user);
        return NextResponse.json({ providers, token: isNewUser ? user.tokens[user.tokens.length - 1].token : null });
    } catch (error) {
        console.error('Error loading providers:', error);
        return NextResponse.json({ error: 'Failed to load providers' }, { status: 500 });
    }
}
