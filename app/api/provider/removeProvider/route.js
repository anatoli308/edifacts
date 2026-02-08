// app/api/provider/addProvider/route.js
import { getAuthenticatedUser, createGuestUser } from '@/lib/auth';
import { NextResponse } from 'next/server';
import ApiKey from '@/app/models/shared/ApiKey';

export async function POST(request) {
    try {
        // Get authenticated user
        const userId = request.headers.get('x-user-id');
        const token = request.headers.get('x-auth-token');
        let user = await getAuthenticatedUser(userId, token);

        const { providerId } = await request.json();
        if (!user) {
            user = await createGuestUser(backgroundMode);
        }

        // WICHTIG: Reihenfolge der Saves (ohne Transaction)
        // 1. User (falls neu)
        const isNewUser = user.isNew;
        if (isNewUser) {
            await user.save();
            await user.generateAuthToken('web');
        }

        const apiKeyToRemove = await ApiKey.findOne({ _id: providerId, ownerId: user._id });
        if (apiKeyToRemove) {
            await apiKeyToRemove.deleteOne();
        }

        return NextResponse.json({
            success: true,
            apiKeyId: apiKeyToRemove._id,
            message: 'Provider removed successfully',
            token: isNewUser ? user.tokens[user.tokens.length - 1].token : null
        });

    } catch (error) {
        console.error('Remove provider error:', error);
        return NextResponse.json(
            { error: 'Server error removing provider' },
            { status: 500 }
        );
    }
}
