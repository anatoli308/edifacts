import { NextResponse } from 'next/server';
import { userRepo } from '@/lib/db/repositories';

export async function POST(request) {
    try {
        const body = await request.json();
        const { email, password, device } = body;

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        const user = await userRepo.findByCredentials(email, password);
        const token = await userRepo.issueToken(user.id, device || 'web');

        return NextResponse.json({
            user: userRepo.toPublicJSON(user),
            token
        }, { status: 200 });

    } catch (error) {
        console.error('Login error:', error.message);

        if (error.message?.includes('Unable to login')) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }
        if (error.message?.includes('banned')) {
            return NextResponse.json(
                { error: 'Your account has been banned' },
                { status: 403 }
            );
        }
        return NextResponse.json(
            { error: 'An error occurred during login' },
            { status: 500 }
        );
    }
}
