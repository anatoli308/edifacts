/**
 * Message Helpers — thin facade over messageRepo.
 * Kept for backwards compatibility with existing imports.
 */
import { messageRepo } from './db/repositories/index.js';

export async function createChatMessages(chatId, messagesData) {
    return messageRepo.createMany(chatId, messagesData);
}

export async function countChatMessages(chatId, filter = {}) {
    return messageRepo.count(chatId, filter);
}

export async function loadChatMessagesPaginated(chatId, page = 1, pageSize = 50) {
    return messageRepo.listPaginated(chatId, page, pageSize);
}
