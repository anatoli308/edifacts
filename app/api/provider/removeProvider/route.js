// app/api/provider/removeProvider/route.js
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { apiKeyRepo } from '@/lib/db/repositories';

export async function POST(request) {
    try {
        const userId = request.headers.get('x-user-id');
        const token = request.headers.get('x-auth-token');
        const user = await getAuthenticatedUser(userId, token);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { providerId } = await request.json();
        if (!providerId) {
            return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
        }

        const existing = await apiKeyRepo.findOwnedByUser(providerId, user.id);
        if (!existing) {
            return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
        }
        await apiKeyRepo.remove(existing.id);

        return NextResponse.json({
            success: true,
            apiKeyId: existing.id,
            message: 'Provider removed successfully',
        });

    } catch (error) {
        console.error('Remove provider error:', error);
        return NextResponse.json({ error: 'Server error removing provider' }, { status: 500 });
    }
}
