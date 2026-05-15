import { NextResponse } from 'next/server';
import { userRepo } from '@/lib/db/repositories';

export async function POST(request) {
    try {
        const body = await request.json();
        const { name, email, password, tosAccepted } = body;

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

        const existing = await userRepo.existsByEmailOrName({ email, name });
        if (existing) {
            if (existing.email === email.toLowerCase().trim()) {
                return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
            }
            if (existing.name === name) {
                return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
            }
        }

        await userRepo.create({
            name,
            email,
            password,
            tosAccepted,
            role: 'USER',
        });

        return NextResponse.json({ ok: true }, { status: 201 });

    } catch (error) {
        console.error('Registration error:', error);
        if (error.message?.includes('Invalid Email')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Email or username already taken' }, { status: 409 });
        }
        return NextResponse.json(
            { error: 'An error occurred during registration' },
            { status: 500 }
        );
    }
}
