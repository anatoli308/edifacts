import { NextResponse } from 'next/server';
import dbConnect from '@/app/lib/dbConnect';
import User from '@/app/models/User';

export async function POST(request) {
    try {
        const body = await request.json();
        const { name, email, password, tosAccepted } = body;

        // Validierung
        if (!name || !email || !password) {
            return NextResponse.json(
                { error: 'Name, email and password are required' },
                { status: 400 }
            );
        }

        if (!tosAccepted) {
            return NextResponse.json(
                { error: 'You must accept the terms of service' },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                { error: 'Password must be at least 8 characters' },
                { status: 400 }
            );
        }

        await dbConnect();

        // Prüfen ob User bereits existiert
        const existingUser = await User.findOne({ $or: [{ email }, { name }] });
        
        if (existingUser) {
            if (existingUser.email === email) {
                return NextResponse.json(
                    { error: 'Email already registered' },
                    { status: 409 }
                );
            }
            if (existingUser.name === name) {
                return NextResponse.json(
                    { error: 'Username already taken' },
                    { status: 409 }
                );
            }
        }

        // User erstellen
        const user = new User({
            name,
            email,
            password,
            tosAccepted
        });

        await user.save();

        // Token generieren
        const token = await user.generateAuthToken('web');

        return NextResponse.json({
            user: user.toJSON(),
            token
        }, { status: 201 });

    } catch (error) {
        console.error('Registration error:', error);
        
        // Mongoose Validation Errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return NextResponse.json(
                { error: messages.join(', ') },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'An error occurred during registration' },
            { status: 500 }
        );
    }
}
