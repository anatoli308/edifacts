/**
 * AnalysisMessage Repository
 * ==========================
 * Bulk insert + paginated reads.
 */
import prisma from '../prisma.js';

export async function createMany(chatId, messages) {
    if (!chatId || !Array.isArray(messages) || messages.length === 0) return { count: 0 };
    const data = messages.map(msg => ({
        ...(msg.id ? { id: msg.id } : {}),
        chatId,
        role: msg.role,
        content: msg.content || '',
        fileIds: Array.isArray(msg.fileIds) ? msg.fileIds : (Array.isArray(msg.files) ? msg.files : []),
        domainContext: msg.domainContext || {},
        metadata: msg.metadata || {},
        agentPlan: msg.agentPlan ?? null,
        toolCalls: msg.toolCalls || [],
        toolResults: msg.toolResults || [],
        usage: msg.usage || {},
    }));
    return prisma.analysisMessage.createMany({ data });
}

export async function count(chatId, filter = {}) {
    if (!chatId) return 0;
    return prisma.analysisMessage.count({
        where: { chatId, ...filter },
    });
}

export async function listPaginated(chatId, page = 1, pageSize = 50) {
    const skip = (page - 1) * pageSize;
    const total = await count(chatId);
    const messages = await prisma.analysisMessage.findMany({
        where: { chatId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: pageSize,
    });
    return {
        messages,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasMore: skip + messages.length < total,
    };
}

export async function listForChat(chatId) {
    if (!chatId) return [];
    return prisma.analysisMessage.findMany({
        where: { chatId },
        orderBy: { createdAt: 'asc' },
    });
}

export const messageRepo = {
    createMany,
    count,
    listPaginated,
    listForChat,
};

export default messageRepo;
