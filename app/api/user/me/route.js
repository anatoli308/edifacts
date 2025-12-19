import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

//app imports
import dbConnect from '@/app/lib/dbConnect';
import User from '@/app/models/User';

export async function GET(request) {
    try {
        // User-ID kommt von Middleware (bereits verifiziert)
        const userId = request.headers.get('x-user-id');

        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        await dbConnect();
        const user = await User.findById(userId);
        if (!user || user.banned) {
            return NextResponse.json(
                { error: 'User not found or banned' },
                { status: 403 }
            );
        }

        return NextResponse.json(user);
    } catch (error) {
        return NextResponse.json(
            { error: 'Invalid token' },
            { status: 401 }
        );
    }
}