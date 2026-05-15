// app/api/user/settings/updateBackground/route.js
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { userRepo } from '@/lib/db/repositories';

const VALID_MODES = ['white', 'black', '#1a2a3b'];

export async function PATCH(request) {
    try {
        const userId = request.headers.get('x-user-id');
        const token = request.headers.get('x-auth-token');
        const user = await getAuthenticatedUser(userId, token);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { backgroundMode } = await request.json();
        if (!VALID_MODES.includes(backgroundMode)) {
            return NextResponse.json({ error: 'Invalid background mode' }, { status: 400 });
        }

        const updated = await userRepo.update(user.id, {
            theme: { ...(user.theme || {}), backgroundMode },
        });

        return NextResponse.json({ success: true, user: userRepo.toPublicJSON(updated) });
    } catch (error) {
        console.error('Update error:', error);
        return NextResponse.json({ error: 'Server error updating background' }, { status: 500 });
    }
}