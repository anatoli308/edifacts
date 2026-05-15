/**
 * MessageFeedback Repository
 * ==========================
 * Per-message thumbs up / down with toggle-off semantics:
 *
 *   first click on 👍       → INSERT rating=+1
 *   click 👍 again          → DELETE  (toggle off)
 *   click 👎 after 👍       → UPDATE rating=-1 (switch sides)
 *   click 👎 again          → DELETE
 *
 * Returns the resulting state so the UI can update without a refetch:
 *   { rating: 1 | -1 | null, feedback: {...} | null }
 */

import prisma from '../prisma.js';

const VALID_RATINGS = new Set([1, -1]);

const _normalizeChunkIds = (ids) => {
    if (!Array.isArray(ids)) return [];
    return ids
        .filter((id) => typeof id === 'string' && id.length > 0)
        .slice(0, 50);
};

/**
 * Toggle / upsert feedback for a (messageId, userId) pair.
 *
 * @param {object} params
 * @param {string} params.messageId
 * @param {string} params.userId
 * @param {1 | -1} params.rating
 * @param {string} [params.comment]
 * @param {string[]} [params.retrievedChunkIds]
 * @returns {Promise<{ rating: 1 | -1 | null, feedback: object | null }>}
 */
const setRating = async ({ messageId, userId, rating, comment = '', retrievedChunkIds = [] }) => {
    if (!messageId || !userId) {
        throw new Error('setRating: messageId and userId are required');
    }
    if (!VALID_RATINGS.has(rating)) {
        throw new Error(`setRating: invalid rating "${rating}" (must be 1 or -1)`);
    }

    const existing = await prisma.messageFeedback.findUnique({
        where: { messageId_userId: { messageId, userId } },
    });

    // Same rating clicked again → toggle off (delete row).
    if (existing && existing.rating === rating) {
        await prisma.messageFeedback.delete({ where: { id: existing.id } });
        return { rating: null, feedback: null };
    }

    const data = {
        rating,
        comment: typeof comment === 'string' ? comment.slice(0, 2000) : '',
        retrievedChunkIds: _normalizeChunkIds(retrievedChunkIds),
    };

    const feedback = existing
        ? await prisma.messageFeedback.update({
            where: { id: existing.id },
            data,
        })
        : await prisma.messageFeedback.create({
            data: { messageId, userId, ...data },
        });

    return { rating: feedback.rating, feedback };
};

const remove = async ({ messageId, userId }) => {
    if (!messageId || !userId) {
        throw new Error('remove: messageId and userId are required');
    }
    const existing = await prisma.messageFeedback.findUnique({
        where: { messageId_userId: { messageId, userId } },
    });
    if (!existing) return { rating: null, feedback: null };
    await prisma.messageFeedback.delete({ where: { id: existing.id } });
    return { rating: null, feedback: null };
};

const get = async ({ messageId, userId }) => {
    if (!messageId || !userId) return null;
    return prisma.messageFeedback.findUnique({
        where: { messageId_userId: { messageId, userId } },
    });
};

export default { setRating, remove, get };
