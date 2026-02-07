/**
 * Helper Functions für AnalysisMessage Operations
 * 
 * Verwendung mit separater Messages Collection (nicht mehr embedded)
 */

import AnalysisMessage from '@/models/edifact/AnalysisMessage';

/**
 * Lädt alle Messages für einen Chat
 * @param {string} chatId - MongoDB ObjectId des Chats
 * @param {object} options - Optional { limit, skip, lean }
 * @returns {Promise<Array>} Messages chronologisch sortiert
 */
export async function loadChatMessages(chatId, options = {}) {
    const {
        limit = 100,
        skip = 0,
        lean = true
    } = options;

    const query = AnalysisMessage
        .find({ chatId })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit);

    return lean ? query.lean() : query.exec();
}

/**
 * Erstellt eine neue Message für einen Chat
 * @param {string} chatId - MongoDB ObjectId des Chats
 * @param {object} messageData - Message Daten (role, content, etc.)
 * @returns {Promise<object>} Erstellte Message
 */
export async function createChatMessage(chatId, messageData) {
    const message = await AnalysisMessage.create({
        chatId,
        ...messageData
    });

    return message.toObject();
}

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
 * Lädt nur die letzten N Messages (z.B. für Context Window)
 * @param {string} chatId - MongoDB ObjectId des Chats
 * @param {number} count - Anzahl der letzten Messages
 * @returns {Promise<Array>} Letzte Messages chronologisch sortiert
 */
export async function loadRecentMessages(chatId, count = 20) {
    const messages = await AnalysisMessage
        .find({ chatId })
        .sort({ createdAt: -1 })
        .limit(count)
        .lean();

    return messages.reverse(); // Chronologisch sortieren
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
 * Löscht alle Messages für einen Chat
 * @param {string} chatId - MongoDB ObjectId des Chats
 * @returns {Promise<object>} Delete result { deletedCount }
 */
export async function deleteChatMessages(chatId) {
    const result = await AnalysisMessage.deleteMany({ chatId });
    return { deletedCount: result.deletedCount };
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

/**
 * Sucht Messages nach Content oder Rolle
 * @param {string} chatId - MongoDB ObjectId des Chats
 * @param {object} query - Such-Query { role?, content?, toolCalls? }
 * @returns {Promise<Array>} Matching messages
 */
export async function searchChatMessages(chatId, query) {
    const filter = { chatId };

    if (query.role) {
        filter.role = query.role;
    }

    if (query.content) {
        filter.content = { $regex: query.content, $options: 'i' };
    }

    if (query.toolCalls) {
        filter['toolCalls.0'] = { $exists: true };
    }

    return await AnalysisMessage
        .find(filter)
        .sort({ createdAt: 1 })
        .lean();
}
