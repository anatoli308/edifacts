// app/api/user/settings/updateBackground/route.js
import { NextResponse } from 'next/server';
import dbConnect from '@/app/lib/dbConnect';
import User from '@/app/models/User';

export async function PATCH(request) {
    try {
        // User-ID kommt von Middleware (bereits verifiziert)
        const userId = request.headers.get('x-user-id');

        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { backgroundMode } = await request.json();

        await dbConnect();
        const user = await User.findById(userId);

        if (!user || user.banned) {
            return NextResponse.json(
                { error: 'User not found or banned' },
                { status: 403 }
            );
        }

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
            { error: 'Server error' },
            { status: 500 }
        );
    }
}