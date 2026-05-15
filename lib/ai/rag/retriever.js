/**
 * RAG Retriever
 * =============
 * Hybrid retrieval over the `knowledge_chunks` table.
 *
 * Strategy:
 *   1. searchExact()    — index lookup by (source?, category?, code)
 *   2. searchSemantic() — pgvector cosine-distance ANN over the HNSW index
 *   3. hybridSearch()   — exact-first; if no hit, fall back to semantic
 *
 * Why hybrid:
 *   EDIFACT lookups are often deterministic ("what is DTM qualifier 137?").
 *   Exact match is free, fast, and avoids embedding-noise. Semantic search
 *   covers the long tail ("when do I use a delivery date qualifier?").
 *
 * Vector format note:
 *   pgvector parses the textual form `'[0.1, 0.2, ...]'` on INSERT/SELECT.
 *   We pass embeddings as bracketed strings via Prisma.$queryRaw to avoid
 *   adapter-driver type wrangling.
 */

import { prisma } from '../../db/prisma.js';
import { embed } from './embedder.js';

const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 50;

const _vectorLiteral = (vec) => `[${vec.join(',')}]`;

const _normalizeTopK = (k) => {
    const n = Number.isFinite(k) ? Math.floor(k) : DEFAULT_TOP_K;
    return Math.max(1, Math.min(MAX_TOP_K, n));
};

/**
 * Exact-match lookup. All filters are optional but at least one must be set.
 *
 * @param {object} [opts]
 * @param {string} [opts.source]
 * @param {string} [opts.category]
 * @param {string} [opts.code]
 * @param {object} [opts.metadataFilter] jsonb containment filter, e.g. { userId: "u1" }
 */
export const searchExact = async ({ source, category, code, metadataFilter } = {}) => {
    if (!source && !category && !code && !metadataFilter) {
        throw new Error('searchExact: at least one of {source, category, code, metadataFilter} is required');
    }

    const metaJson = _metaFilterJson(metadataFilter);

    const rows = await prisma.$queryRaw`
        SELECT id, source, category, code, title, content, metadata
        FROM knowledge_chunks
        WHERE
            (${source}::text IS NULL OR source = ${source}::text)
            AND (${category}::text IS NULL OR category = ${category}::text)
            AND (${code}::text IS NULL OR code = ${code}::text)
            AND (${metaJson}::jsonb IS NULL OR metadata @> ${metaJson}::jsonb)
        LIMIT 25
    `;

    return rows.map(_shapeRow);
};

/**
 * Pure semantic search. Embeds the query once and returns nearest neighbours
 * by cosine distance.
 *
 * @param {string} query
 * @param {object} [opts]
 * @param {number} [opts.topK=5]
 * @param {string} [opts.source]            optional pre-filter
 * @param {string} [opts.category]          optional pre-filter
 * @param {object} [opts.metadataFilter]    jsonb containment, e.g. { userId: "u1" }
 */
export const searchSemantic = async (query, opts = {}) => {
    if (typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('searchSemantic: query must be a non-empty string');
    }

    const topK = _normalizeTopK(opts.topK);
    const source = opts.source ?? null;
    const category = opts.category ?? null;
    const metaJson = _metaFilterJson(opts.metadataFilter);

    const vector = await embed(query);
    const literal = _vectorLiteral(vector);

    // `embedding <=> $1` is cosine distance in pgvector. Lower = more similar.
    // We expose `similarity = 1 - distance` for caller convenience.
    const rows = await prisma.$queryRaw`
        SELECT
            id, source, category, code, title, content, metadata,
            1 - (embedding <=> ${literal}::vector) AS similarity
        FROM knowledge_chunks
        WHERE
            (${source}::text IS NULL OR source = ${source}::text)
            AND (${category}::text IS NULL OR category = ${category}::text)
            AND (${metaJson}::jsonb IS NULL OR metadata @> ${metaJson}::jsonb)
        ORDER BY embedding <=> ${literal}::vector
        LIMIT ${topK}
    `;

    return rows.map(_shapeRow);
};

/**
 * Hybrid retrieval: exact first (if a code is supplied), otherwise semantic.
 *
 * @param {object} params
 * @param {string} params.query             natural-language description
 * @param {string} [params.code]            exact code if user already knows it
 * @param {string} [params.source]
 * @param {string} [params.category]
 * @param {object} [params.metadataFilter]  jsonb containment, e.g. { userId: "u1" }
 * @param {number} [params.topK=5]
 */
export const hybridSearch = async ({ query, code, source, category, metadataFilter, topK } = {}) => {
    if (code) {
        const exact = await searchExact({ source, category, code, metadataFilter });
        if (exact.length > 0) {
            return { mode: 'exact', results: exact };
        }
    }

    if (typeof query === 'string' && query.trim().length > 0) {
        const semantic = await searchSemantic(query, { topK, source, category, metadataFilter });
        return { mode: 'semantic', results: semantic };
    }

    return { mode: 'empty', results: [] };
};

const _metaFilterJson = (filter) => {
    if (!filter || typeof filter !== 'object') return null;
    if (Object.keys(filter).length === 0) return null;
    return JSON.stringify(filter);
};

const _shapeRow = (row) => ({
    id: row.id,
    source: row.source,
    category: row.category,
    code: row.code,
    title: row.title,
    content: row.content,
    metadata: row.metadata ?? {},
    similarity: typeof row.similarity === 'number' ? row.similarity : undefined,
});
