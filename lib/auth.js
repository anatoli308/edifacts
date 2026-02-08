import User from '../models/shared/User.js';
import AnalysisChat from '../models/shared/AnalysisChat.js';
import ApiKey from '../models/shared/ApiKey.js';
import dbConnect from './dbConnect.js';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

export function createGuestUser(backgroundMode) {
    const nowAsNumber = Date.now();
    const guestName = `g_${nowAsNumber}`;
    const newUser = new User({
        name: guestName,
        email: guestName + '@edifacts.com',
        password: randomUUID(),
        tosAccepted: true,
        theme: { backgroundMode: backgroundMode || 'white' },
    });
    console.log(`Creating guest user: ${guestName} with background: ${backgroundMode}`);
    return newUser;
}

export async function getApiKeysForUser(user) {
    await dbConnect();
    const apiKeys = await ApiKey.find({ ownerId: user._id }).select({ provider: 1, name: 1, baseUrl: 1, models: 1, encryptedKey: 1 }).lean();
    return apiKeys;
}

export async function getAuthenticatedUser(userId, token) {
    if (!userId) return null;
    await dbConnect();
    const user = await User.findOne({ _id: userId, "tokens.token": token });
    if (!user || user.banned) return null;
    return user;
}

export async function getAnalysisChatsForUser(user, limit = 15) {
    await dbConnect();
    const chats = await AnalysisChat.find({ creatorId: user._id })
        .select({ _id: 1, name: 1 })
        .sort({ createdAt: -1 })
        .limit(limit);
    return chats.map(chat => ({ _id: chat._id.toString(), name: chat.name }));
}

export async function getAnalysisChat(sessionId, user) {
    await dbConnect();

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(sessionId) || !user) {
        return null;
    }
    const chat = await AnalysisChat.findOne({ _id: sessionId, creatorId: user._id });
    if (!chat) {
        return null;
    }
    return chat.toJSON();
}