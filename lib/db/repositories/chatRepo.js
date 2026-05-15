/**
 * AnalysisChat Repository
 * =======================
 * Cascade-delete to messages/files is handled by Prisma `onDelete: Cascade`
 * — replaces Mongoose pre('deleteOne') / pre('findOneAndDelete') hooks.
 */
import prisma from '../prisma.js';

export async function findById(id) {
    if (!id) return null;
    return prisma.analysisChat.findUnique({ where: { id } });
}

export async function findByIdAndOwner(id, creatorId) {
    if (!id || !creatorId) return null;
    return prisma.analysisChat.findFirst({
        where: { id, creatorId },
    });
}

export async function listForUser(creatorId, limit = 15) {
    if (!creatorId) return [];
    return prisma.analysisChat.findMany({
        where: { creatorId },
        select: { id: true, name: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
}

export async function create({ id, name, creatorId, apiKeyRef, selectedModel, settings = {}, domainContext = {} }) {
    return prisma.analysisChat.create({
        data: {
            ...(id ? { id } : {}),
            name,
            creatorId,
            apiKeyRef,
            selectedModel,
            settings,
            domainContext,
        },
    });
}

export async function update(id, data) {
    return prisma.analysisChat.update({
        where: { id },
        data,
    });
}

/**
 * Patch the embedded EDIFACT analysis JSONB.
 * Replaces: AnalysisChat.findByIdAndUpdate(jobId, { $set: { 'domainContext.edifact._analysis': msg.analysis } })
 */
export async function setEdifactAnalysis(id, analysis) {
    const chat = await prisma.analysisChat.findUnique({
        where: { id },
        select: { domainContext: true },
    });
    if (!chat) return null;

    const next = {
        ...(chat.domainContext || {}),
        edifact: {
            ...((chat.domainContext && chat.domainContext.edifact) || {}),
            _analysis: analysis,
        },
    };

    return prisma.analysisChat.update({
        where: { id },
        data: { domainContext: next },
    });
}

export async function remove(id) {
    return prisma.analysisChat.delete({ where: { id } });
}

export const chatRepo = {
    findById,
    findByIdAndOwner,
    listForUser,
    create,
    update,
    setEdifactAnalysis,
    remove,
};

export default chatRepo;
