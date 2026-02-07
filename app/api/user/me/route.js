
import { NextResponse } from 'next/server';

//app imports
import { getAuthenticatedUser } from '@/lib/auth';

export async function GET(request) {
    try {
        const userId = request.headers.get('x-user-id');
        const token = request.headers.get('x-auth-token');
        const user = await getAuthenticatedUser(userId, token);
        return NextResponse.json(user);
    } catch (error) {
        console.log('Error in /api/user/me:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}