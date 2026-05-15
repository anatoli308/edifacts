/**
 * File Repository
 * ===============
 * Persistence for uploaded EDIFACT files.
 */
import prisma from '../prisma.js';

export async function findById(id) {
    if (!id) return null;
    return prisma.file.findUnique({ where: { id } });
}

export async function create({ id, ownerId, chatId, originalName, path, size, mimetype, storage = 'local', status = 'complete', metadata = {} }) {
    return prisma.file.create({
        data: {
            ...(id ? { id } : {}),
            ownerId,
            chatId,
            originalName,
            path,
            size,
            mimeType: mimetype,
            storage,
            status,
            metadata,
        },
    });
}

export async function update(id, data) {
    return prisma.file.update({
        where: { id },
        data,
    });
}

export async function setMetadata(id, metadata) {
    return prisma.file.update({
        where: { id },
        data: { metadata },
    });
}

export async function remove(id) {
    return prisma.file.delete({ where: { id } });
}

export const fileRepo = {
    findById,
    create,
    update,
    setMetadata,
    remove,
};

export default fileRepo;
