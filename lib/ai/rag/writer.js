/**
 * Knowledge Base Writer
 * =====================
 * Idempotent upsert of chunks into `knowledge_chunks`.
 *
 * Each chunk has a stable conflict key:
 *   - (source, category, code)   when `code` is set     → coded lookups
 *   - (source, category, title)  when `code` is null    → long-form docs
 *
 * Re-running upsertChunks() refreshes content + metadata + embedding in place,
 * so the seed script is safe to re-run on every deploy.
 */

import { prisma } from '../../db/prisma.js';
import { embedBatch } from './embedder.js';

const EMBED_BATCH = 32;
const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const _vectorLiteral = (vec) => `[${vec.join(',')}]`;

/**
 * Only real UUIDs can be cast to ::uuid for the FK column. Synthetic IDs
 * (e.g. eval-harness fixtures like "eval-user-mem-1") would crash the
 * INSERT with 22P02. For those rows we keep userId only in metadata.
 */
const _coerceUserId = (id) => (typeof id === 'string' && UUID_RE.test(id) ? id : null);

/**
 * @typedef {object} Chunk
 * @property {string}  source
 * @property {string}  category
 * @property {string|null} [code]
 * @property {string}  title
 * @property {string}  content
 * @property {object}  [metadata]
 * @property {string|null} [userId]        FK to users(id); set for USER_MEMORY rows
 * @property {string}  [embeddingModel]    defaults to nomic-embed-text
 */

/**
 * Compose the text fed into the embedding model. We concatenate title +
 * content + a flat metadata projection so retrieval can hit on either layer.
 */
const _buildEmbeddingText = (chunk) => {
    const parts = [];
    if (chunk.code) parts.push(`[${chunk.category} ${chunk.code}]`);
    else parts.push(`[${chunk.category}]`);
    parts.push(chunk.title);
    parts.push(chunk.content);

    if (chunk.metadata && typeof chunk.metadata === 'object') {
        const flat = Object.entries(chunk.metadata)
            .filter(([, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
            .join(' | ');
        if (flat) parts.push(flat);
    }

    return parts.join('\n');
};

/**
 * Upsert a batch of chunks. Embeddings are computed in groups of EMBED_BATCH
 * to amortize HTTP overhead; SQL upserts run one row at a time so a single
 * bad row does not poison the batch.
 *
 * @param {Chunk[]} chunks
 * @returns {Promise<{ inserted: number, skipped: number }>}
 */
export const upsertChunks = async (chunks) => {
    if (!Array.isArray(chunks) || chunks.length === 0) {
        return { inserted: 0, skipped: 0 };
    }

    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
        const batch = chunks.slice(i, i + EMBED_BATCH);
        const texts = batch.map(_buildEmbeddingText);
        const vectors = await embedBatch(texts);

        for (let j = 0; j < batch.length; j += 1) {
            const chunk = batch[j];
            const vec = vectors[j];

            if (!Array.isArray(vec) || vec.length === 0) {
                skipped += 1;
                continue;
            }

            const literal = _vectorLiteral(vec);
            const metadata = chunk.metadata ?? {};
            const userId = _coerceUserId(chunk.userId);
            const embeddingModel = chunk.embeddingModel ?? DEFAULT_EMBEDDING_MODEL;

            if (chunk.code) {
                await prisma.$executeRaw`
                    INSERT INTO knowledge_chunks
                        (source, category, code, title, content, metadata,
                         user_id, embedding_model, embedding, updated_at)
                    VALUES
                        (${chunk.source}, ${chunk.category}, ${chunk.code},
                         ${chunk.title}, ${chunk.content},
                         ${metadata}::jsonb,
                         ${userId}::uuid, ${embeddingModel},
                         ${literal}::vector, now())
                    ON CONFLICT (source, category, code) WHERE code IS NOT NULL
                    DO UPDATE SET
                        title           = EXCLUDED.title,
                        content         = EXCLUDED.content,
                        metadata        = EXCLUDED.metadata,
                        user_id         = EXCLUDED.user_id,
                        embedding_model = EXCLUDED.embedding_model,
                        embedding       = EXCLUDED.embedding,
                        updated_at      = now()
                `;
            } else {
                await prisma.$executeRaw`
                    INSERT INTO knowledge_chunks
                        (source, category, code, title, content, metadata,
                         user_id, embedding_model, embedding, updated_at)
                    VALUES
                        (${chunk.source}, ${chunk.category}, NULL,
                         ${chunk.title}, ${chunk.content},
                         ${metadata}::jsonb,
                         ${userId}::uuid, ${embeddingModel},
                         ${literal}::vector, now())
                    ON CONFLICT (source, category, title) WHERE code IS NULL
                    DO UPDATE SET
                        content         = EXCLUDED.content,
                        metadata        = EXCLUDED.metadata,
                        user_id         = EXCLUDED.user_id,
                        embedding_model = EXCLUDED.embedding_model,
                        embedding       = EXCLUDED.embedding,
                        updated_at      = now()
                `;
            }

            inserted += 1;
        }
    }

    return { inserted, skipped };
};

export const countChunks = async () => {
    const rows = await prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM knowledge_chunks`;
    return rows?.[0]?.n ?? 0;
};

export const deleteBySource = async (source) => {
    if (!source || typeof source !== 'string') {
        throw new Error('deleteBySource: source is required');
    }
    return prisma.$executeRaw`DELETE FROM knowledge_chunks WHERE source = ${source}`;
};

/**
 * Delete all chunks whose `metadata` jsonb contains the given filter.
 * Primary use: GDPR right-to-be-forgotten for user memory.
 *
 *   deleteByMetadata({ userId: 'u1' })
 *     → DELETE WHERE metadata @> '{"userId":"u1"}'::jsonb
 *
 * @param {object} filter            non-empty object, jsonb containment
 * @returns {Promise<number>}        affected row count
 */
export const deleteByMetadata = async (filter) => {
    if (!filter || typeof filter !== 'object' || Object.keys(filter).length === 0) {
        throw new Error('deleteByMetadata: non-empty filter object is required');
    }
    const json = JSON.stringify(filter);
    return prisma.$executeRaw`DELETE FROM knowledge_chunks WHERE metadata @> ${json}::jsonb`;
};

/**
 * Delete all chunks owned by the given user via the FK column.
 * Primary path for GDPR right-to-be-forgotten — uses the indexed FK column
 * rather than jsonb containment. Falls back to also clearing legacy rows
 * that only carry the userId in metadata (pre-FK rows).
 *
 * @param {string} userId          uuid of the user
 * @returns {Promise<number>}      affected row count
 */
export const deleteByUserId = async (userId) => {
    if (!userId || typeof userId !== 'string') {
        throw new Error('deleteByUserId: userId is required');
    }
    const metaJson = JSON.stringify({ userId });
    const uuid = _coerceUserId(userId);

    // Synthetic (non-UUID) IDs never made it into the FK column, so they
    // only live in metadata. Real UUIDs may live in both — clean both paths.
    if (uuid) {
        return prisma.$executeRaw`
            DELETE FROM knowledge_chunks
            WHERE user_id = ${uuid}::uuid
               OR (user_id IS NULL AND metadata @> ${metaJson}::jsonb)
        `;
    }
    return prisma.$executeRaw`
        DELETE FROM knowledge_chunks
        WHERE metadata @> ${metaJson}::jsonb
    `;
};
