/**
 * Auth helpers — Prisma edition.
 * ==============================
 * Replaces Mongoose-based lookups. Guest user creation now persists
 * immediately via userRepo (was previously an unsaved Mongoose doc).
 */
import { randomUUID } from 'crypto';
import { userRepo, apiKeyRepo, chatRepo } from './db/repositories/index.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Creates AND PERSISTS a guest user.
 * Signature change vs Mongoose version: now async, returns persisted user.
 * Caller still needs `userRepo.issueToken(user.id, device)` for a JWT.
 */
export async function createGuestUser(backgroundMode) {
    const stamp = Date.now();
    const guestName = `g_${stamp}`;
    const user = await userRepo.create({
        name: guestName,
        email: `${guestName}@edifacts.com`,
        password: randomUUID(),
        role: 'GUEST',
        tosAccepted: true,
        theme: { backgroundMode: backgroundMode || 'white' },
    });
    console.log(`Creating guest user: ${guestName} with background: ${backgroundMode}`);
    return user;
}

export async function getApiKeysForUser(user) {
    if (!user?.id) return [];
    return apiKeyRepo.findByOwner(user.id);
}

export async function getAuthenticatedUser(userId, token) {
    if (!userId || !token) return null;
    const user = await userRepo.findByIdWithToken(userId, token);
    if (!user || user.banned) return null;
    return user;
}

export async function getAnalysisChatsForUser(user, limit = 15) {
    if (!user?.id) return [];
    const chats = await chatRepo.listForUser(user.id, limit);
    return chats.map(c => ({ _id: c.id, id: c.id, name: c.name }));
}

export async function getAnalysisChat(sessionId, user) {
    if (!sessionId || !user?.id) return null;
    if (!UUID_REGEX.test(sessionId)) return null;
    return chatRepo.findByIdAndOwner(sessionId, user.id);
}