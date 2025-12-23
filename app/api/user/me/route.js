
import { NextResponse } from 'next/server';

//app imports
import { getAuthenticatedUser } from '@/app/lib/auth';

export async function GET(request) {
    try {
        const user = await getAuthenticatedUser(request);
        return NextResponse.json(user);
    } catch (error) {
        console.log('Error in /api/user/me:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}