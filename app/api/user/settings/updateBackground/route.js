// app/api/user/settings/updateBackground/route.js
import { getAuthenticatedUser } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PATCH(request) {
    try {
        // User-ID kommt von Middleware (bereits verifiziert)
        const userId = request.headers.get('x-user-id');
        const token = request.headers.get('x-auth-token');
        const user = await getAuthenticatedUser(userId, token);

        const { backgroundMode } = await request.json();
        // Validierung + Update
        const validModes = ['white', 'black', '#1a2a3b'];
        if (!validModes.includes(backgroundMode)) {
            return NextResponse.json(
                { error: 'Invalid background mode' },
                { status: 400 }
            );
        }

        user.theme.backgroundMode = backgroundMode;
        user.edited = new Date();
        await user.save();

        return NextResponse.json({ success: true, user });
    } catch (error) {
        console.error('Update error:', error);
        return NextResponse.json(
            { error: 'Server error updating background' },
            { status: 500 }
        );
    }
}