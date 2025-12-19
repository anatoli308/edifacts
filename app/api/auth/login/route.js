import { NextResponse } from 'next/server';

//app imports
import dbConnect from '@/app/lib/dbConnect';
import User from '@/app/models/User';

export async function POST(request) {
    try {
        const body = await request.json();
        const { email, password, device } = body;

        // Validierung
        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        await dbConnect();

        // Login mit der static method aus dem User Model
        const user = await User.findByCredentials(email, password);

        console.log("Device:", device);
        // Token generieren
        const token = await user.generateAuthToken(device || 'web');

        return NextResponse.json({
            user: user.toJSON(),
            token
        }, { status: 200 });

    } catch (error) {
        console.error('Login error:', error.message);

        // Spezifische Fehlermeldungen
        if (error.message.includes('Unable to login')) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        if (error.message.includes('banned')) {
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
