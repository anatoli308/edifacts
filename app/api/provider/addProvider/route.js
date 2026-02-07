// app/api/provider/addProvider/route.js
import { getAuthenticatedUser } from '@/lib/auth';
import { NextResponse } from 'next/server';
import ApiKey from '@/app/models/shared/ApiKey';

export async function POST(request) {
    try {
        // Get authenticated user
        const userId = request.headers.get('x-user-id');
        const token = request.headers.get('x-auth-token');
        const user = await getAuthenticatedUser(userId, token);

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { provider, name, apiKey, baseUrl } = await request.json();

        // Validation
        const validProviders = ['ollama', 'openai', 'anthropic', 'custom'];
        if (!validProviders.includes(provider)) {
            return NextResponse.json(
                { error: 'Invalid provider type' },
                { status: 400 }
            );
        }

        if (!apiKey || !apiKey.trim()) {
            return NextResponse.json(
                { error: 'API key is required' },
                { status: 400 }
            );
        }

        if (provider === 'custom' && (!baseUrl || !baseUrl.trim())) {
            return NextResponse.json(
                { error: 'Base URL is required for custom provider' },
                { status: 400 }
            );
        }

        // Create new API key document
        // TODO: Implement actual encryption for apiKey before storing
        const newApiKey = new ApiKey({
            ownerId: user._id,
            provider,
            name: name || `${provider} API Key`,
            encryptedKey: apiKey, // TODO: Encrypt this value
            baseUrl: provider === 'custom' ? baseUrl : undefined,
            models: [] // Can be populated later
        });

        await newApiKey.save();

        return NextResponse.json({
            success: true,
            apiKeyId: newApiKey._id,
            message: 'Provider added successfully'
        });

    } catch (error) {
        console.error('Add provider error:', error);
        return NextResponse.json(
            { error: 'Server error adding provider' },
            { status: 500 }
        );
    }
}
