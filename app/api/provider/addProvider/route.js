// app/api/provider/addProvider/route.js
import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createGuestUser } from '@/lib/auth';
import { userRepo, apiKeyRepo } from '@/lib/db/repositories';

const VALID_PROVIDERS = ['ollama', 'openai', 'anthropic'];

async function _fetchModels({ provider, encryptedKey, baseUrl }) {
    try {
        if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/models', {
                headers: { Authorization: `Bearer ${encryptedKey}` }
            });
            if (res.ok) {
                const data = await res.json();
                return data.data?.map(m => m.id) || [];
            }
        } else if (provider === 'anthropic') {
            const res = await fetch('https://api.anthropic.com/v1/models', {
                headers: { Authorization: `Bearer ${encryptedKey}` }
            });
            if (res.ok) {
                const data = await res.json();
                return data.data?.map(m => m.id) || [];
            }
        } else if (provider === 'ollama' || provider === 'custom') {
            const url = provider === 'custom' ? baseUrl : 'http://localhost:11434';
            const res = await fetch(`${url}/v1/models`, {
                headers: { Authorization: `Bearer ${encryptedKey}` }
            });
            if (res.ok) {
                const data = await res.json();
                return data.data?.map(m => m.id) || [];
            }
        }
    } catch (err) {
        console.warn('[addProvider] model fetch failed:', err.message);
    }
    return [];
}

export async function POST(request) {
    try {
        const userId = request.headers.get('x-user-id');
        const token = request.headers.get('x-auth-token');
        const { provider, backgroundMode, name, encryptedKey, baseUrl } = await request.json();

        let user = await getAuthenticatedUser(userId, token);
        let isNewUser = false;
        let issuedToken = null;

        if (!user) {
            user = await createGuestUser(backgroundMode);
            isNewUser = true;
            issuedToken = await userRepo.issueToken(user.id, 'web');
        }

        if (!VALID_PROVIDERS.includes(provider)) {
            return NextResponse.json({ error: 'Invalid provider type' }, { status: 400 });
        }
        if (!encryptedKey || !encryptedKey.trim()) {
            return NextResponse.json({ error: 'Api key is required' }, { status: 400 });
        }
        if (provider === 'custom' && (!baseUrl || !baseUrl.trim())) {
            return NextResponse.json({ error: 'Base URL is required for custom provider' }, { status: 400 });
        }

        const models = await _fetchModels({ provider, encryptedKey, baseUrl });

        const newApiKey = await apiKeyRepo.create({
            ownerId: user.id,
            provider,
            name: name || `${provider} API Key`,
            encryptedKey, // TODO: actual encryption
            baseUrl: provider === 'custom' ? baseUrl : null,
            models,
        });

        return NextResponse.json({
            success: true,
            apiKeyId: newApiKey.id,
            message: 'Provider added successfully',
            token: isNewUser ? issuedToken : null,
        });

    } catch (error) {
        console.error('Add provider error:', error);
        return NextResponse.json({ error: 'Server error adding provider' }, { status: 500 });
    }
}
