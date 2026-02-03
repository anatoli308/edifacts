import User from '../models/shared/User.js';
import AnalysisChat from '../models/edifact/AnalysisChat.js';
import dbConnect from './dbConnect.js';
import mongoose from 'mongoose';

export async function getAuthenticatedUser(userId, token) {
    if (!userId) return null;
    await dbConnect();
    const user = await User.findOne({ _id: userId, "tokens.token": token });
    if (!user || user.banned) return null;
    return user;
}

export async function getAnalysisChat(sessionId, user) {
    await dbConnect();

    // Validate ObjectId format
    //if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    //    return null;
    //}
    //TODO: anatoli implement
    //return a mock for now
    const chat = { _id: sessionId }; //await AnalysisChat.findOne({ _id: sessionId, creatorId: user._id });
    return chat;
}