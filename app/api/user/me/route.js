import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';

export async function GET(request) {
    try {
        const authHeader = request.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'No token provided' },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_KEY);

        await dbConnect();
        const user = await User.findOne({
            _id: decoded._id,
            'tokens.token': token
        });

        if (!user || user.banned) {
            return NextResponse.json(
                { error: 'User not found or banned' },
                { status: 404 }
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