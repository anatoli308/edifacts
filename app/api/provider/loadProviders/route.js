import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
export async function GET(request) {
    try {
        const userId = request.headers.get('x-user-id');
        const token = request.headers.get('x-auth-token');
        const user = await getAuthenticatedUser(userId, token);

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }
        const providers = [];
        return NextResponse.json({ providers });
    } catch (error) {
        console.error('Error loading providers:', error);
        return NextResponse.json({ error: 'Failed to load providers' }, { status: 500 });
    }
}
