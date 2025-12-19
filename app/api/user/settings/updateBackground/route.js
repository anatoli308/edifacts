import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/app/lib/dbConnect';
import User from '@/app/models/User';

export async function PATCH(request) {
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

        const body = await request.json();
        const { backgroundMode } = body;

        if (!backgroundMode) {
            return NextResponse.json(
                { error: 'Background mode is required' },
                { status: 400 }
            );
        }

        // Validierung: nur erlaubte Werte
        const allowedModes = ['white', 'black', '#1a2a3b'];
        if (!allowedModes.includes(backgroundMode)) {
            return NextResponse.json(
                { error: 'Invalid background mode' },
                { status: 400 }
            );
        }

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

        // Update background mode
        user.theme.backgroundMode = backgroundMode;
        user.edited = new Date();
        await user.save();

        return NextResponse.json({
            success: true,
            theme: user.theme
        }, { status: 200 });

    } catch (error) {
        console.error('Update background error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return NextResponse.json(
                { error: 'Invalid token' },
                { status: 401 }
            );
        }

        return NextResponse.json(
            { error: 'An error occurred while updating background' },
            { status: 500 }
        );
    }
}
