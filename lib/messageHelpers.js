/**
 * Helper Functions für AnalysisMessage Operations
 * 
 * Verwendung mit separater Messages Collection (nicht mehr embedded)
 */

import AnalysisMessage from '../models/shared/AnalysisMessage.js';

/**
 * Erstellt mehrere Messages auf einmal (Bulk Insert)
 * @param {string} chatId - MongoDB ObjectId des Chats
 * @param {Array<object>} messagesData - Array von Message-Daten
 * @returns {Promise<Array>} Erstellte Messages
 */
export async function createChatMessages(chatId, messagesData) {
    const messages = messagesData.map(msg => ({
        chatId,
        ...msg
    }));

    return await AnalysisMessage.insertMany(messages);
}

/**
 * Zählt Messages für einen Chat
 * @param {string} chatId - MongoDB ObjectId des Chats
 * @param {object} filter - Optional zusätzliche Filter (z.B. { role: 'user' })
 * @returns {Promise<number>} Anzahl Messages
 */
export async function countChatMessages(chatId, filter = {}) {
    return await AnalysisMessage.countDocuments({
        chatId,
        ...filter
    });
}

/**
 * Lädt Messages mit Pagination
 * @param {string} chatId - MongoDB ObjectId des Chats
 * @param {number} page - Seite (1-basiert)
 * @param {number} pageSize - Messages pro Seite
 * @returns {Promise<object>} { messages, total, page, totalPages, hasMore }
 */
export async function loadChatMessagesPaginated(chatId, page = 1, pageSize = 50) {
    const skip = (page - 1) * pageSize;
    const total = await countChatMessages(chatId);

    const messages = await AnalysisMessage
        .find({ chatId })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(pageSize)
        .lean();

    return {
        messages,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasMore: skip + messages.length < total
    };
}
