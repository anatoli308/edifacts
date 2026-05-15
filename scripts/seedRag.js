/**
 * RAG seed script
 * ===============
 * Populates the `knowledge_chunks` table with the full EDIFACT corpus
 * defined in `lib/ai/rag/knowledgeBase.js`.
 *
 * Idempotent: every chunk has a stable conflict key (source, category, code|title)
 * so re-running this script refreshes content + embeddings in place.
 *
 * Usage:
 *   npm run rag:seed
 *
 * Requirements:
 *   - Postgres reachable at DATABASE_URL with pgvector extension installed
 *     (handled by the 20260514120000_rag_knowledge_base migration).
 *   - Ollama reachable at OLLAMA_BASE_URL (or SYSTEM_BASE_URL) with the
 *     embedding model pulled (`ollama pull nomic-embed-text`).
 */

import 'dotenv/config';
import { getAllChunks, upsertChunks, countChunks } from '../lib/ai/rag/index.js';
import { prisma } from '../lib/db/prisma.js';

const main = async () => {
    const chunks = getAllChunks();
    console.log(`[rag:seed] preparing ${chunks.length} chunks for upsert…`);

    const start = Date.now();
    const { inserted, skipped } = await upsertChunks(chunks);
    const took = ((Date.now() - start) / 1000).toFixed(1);

    const total = await countChunks();
    console.log(`[rag:seed] done in ${took}s — upserted=${inserted} skipped=${skipped} totalInDb=${total}`);
};

main()
    .catch((err) => {
        console.error('[rag:seed] failed:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
