// app/api/provider/addProvider/route.js
import { getAuthenticatedUser, createGuestUser } from '@/lib/auth';
import { NextResponse } from 'next/server';
import ApiKey from '@/app/models/shared/ApiKey';

export async function POST(request) {
    try {
        // Get authenticated user
        const userId = request.headers.get('x-user-id');
        const token = request.headers.get('x-auth-token');
        let user = await getAuthenticatedUser(userId, token);

        const { provider, backgroundMode, name, encryptedKey, baseUrl } = await request.json();
        if (!user) {
            user = await createGuestUser(backgroundMode);
        }

        // Validation
        const validProviders = ['ollama', 'openai', 'anthropic'];
        if (!validProviders.includes(provider)) {
            return NextResponse.json(
                { error: 'Invalid provider type' },
                { status: 400 }
            );
        }

        if (!encryptedKey || !encryptedKey.trim()) {
            return NextResponse.json(
                { error: 'Api key is required' },
                { status: 400 }
            );
        }

        if (provider === 'custom' && (!baseUrl || !baseUrl.trim())) {
            return NextResponse.json(
                { error: 'Base URL is required for custom provider' },
                { status: 400 }
            );
        }

        // WICHTIG: Reihenfolge der Saves (ohne Transaction)
        // 1. User (falls neu)
        const isNewUser = user.isNew;
        if (isNewUser) {
            await user.save();
            await user.generateAuthToken('web');
        }

        // Create new API key document
        // TODO: Implement actual encryption for apiKey before storing
        const newApiKey = new ApiKey({
            ownerId: user._id,
            provider,
            name: name || `${provider} API Key`,
            encryptedKey: encryptedKey, // TODO: Encrypt this value
            baseUrl: provider === 'custom' ? baseUrl : undefined,
            models: [] // Can be populated later
        });

        await newApiKey.save();
        
        let models = [];
        if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/models', {
                headers: { Authorization: `Bearer ${encryptedKey}` }
            });
            if (res.ok) {
                const data = await res.json();
                models = data.data.map(m => m.id);
            }
        } else if (provider === 'anthropic') {
            const res = await fetch('https://api.anthropic.com/v1/models', {
                headers: { Authorization: `Bearer ${encryptedKey}` }
            });
            if (res.ok) {
                const data = await res.json();
                models = data.data.map(m => m.id);
            }
        } else if (provider === 'ollama' || provider === 'custom') {
            const res = await fetch(`${provider === 'custom' ? baseUrl : 'http://localhost:11434'}/v1/models`, {
                headers: { Authorization: `Bearer ${encryptedKey}` }
            });
            if (res.ok) {
                const data = await res.json();
                models = data.data.map(m => m.id);
            }
        }
        //TODO : Add model fetching for other providers if needed
        newApiKey.models = models;
        await newApiKey.save();


        return NextResponse.json({
            success: true,
            apiKeyId: newApiKey._id,
            message: 'Provider added successfully',
            token: isNewUser ? user.tokens[user.tokens.length - 1].token : null
        });

    } catch (error) {
        console.error('Add provider error:', error);
        return NextResponse.json(
            { error: 'Server error adding provider' },
            { status: 500 }
        );
    }
}
