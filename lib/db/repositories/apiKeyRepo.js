/**
 * ApiKey Repository
 * =================
 * Wraps all ApiKey persistence (BYOK + system default).
 */
import prisma from '../prisma.js';

export async function findById(id) {
    if (!id) return null;
    return prisma.apiKey.findUnique({ where: { id } });
}

export async function findByOwner(ownerId) {
    if (!ownerId) return [];
    return prisma.apiKey.findMany({
        where: { ownerId },
        select: {
            id: true,
            provider: true,
            name: true,
            baseUrl: true,
            models: true,
            encryptedKey: true,
            ownerId: true,
            createdAt: true,
        },
    });
}

export async function findFirstForOwner(ownerId) {
    if (!ownerId) return null;
    return prisma.apiKey.findFirst({ where: { ownerId } });
}

export async function findSystemDefault({ name, encryptedKey }) {
    return prisma.apiKey.findFirst({
        where: { name, encryptedKey, ownerId: null },
    });
}

export async function findOwnedByUser(id, ownerId) {
    return prisma.apiKey.findFirst({
        where: { id, ownerId },
    });
}

export async function create({ ownerId = null, provider, name, encryptedKey, baseUrl, models = [] }) {
    return prisma.apiKey.create({
        data: {
            ownerId,
            provider,
            name,
            encryptedKey,
            baseUrl,
            models,
        },
    });
}

export async function updateModels(id, models) {
    return prisma.apiKey.update({
        where: { id },
        data: { models },
    });
}

export async function remove(id) {
    return prisma.apiKey.delete({ where: { id } });
}

export const apiKeyRepo = {
    findById,
    findByOwner,
    findFirstForOwner,
    findSystemDefault,
    findOwnedByUser,
    create,
    updateModels,
    remove,
};

export default apiKeyRepo;
