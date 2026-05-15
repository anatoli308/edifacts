/**
 * RAG example-corpus ingest script
 * =================================
 * Walks `edi_files/` and upserts every supported example into the
 * `knowledge_chunks` table with source = 'EDI_EXAMPLE'.
 *
 * Idempotent: each chunk is keyed by its relative path, so re-running
 * refreshes content + embedding in place. Add new files to `edi_files/`
 * and re-run — only the new/changed files get new embeddings.
 *
 * Usage:
 *   npm run rag:examples
 *
 * Optional first arg: custom root folder.
 *   node scripts/ingestExamples.js path/to/other/folder
 */

import 'dotenv/config';
import { getAllExampleChunks, upsertChunks, countChunks, EXAMPLE_SOURCE } from '../lib/ai/rag/index.js';
import { prisma } from '../lib/db/prisma.js';

const main = async () => {
    const root = process.argv[2];
    const chunks = root ? getAllExampleChunks(root) : getAllExampleChunks();
    console.log(`[rag:examples] discovered ${chunks.length} example files`);

    if (chunks.length === 0) {
        console.warn('[rag:examples] nothing to ingest — root folder empty or missing');
        return;
    }

    // group counts per category for visibility
    const perCategory = chunks.reduce((acc, c) => {
        acc[c.category] = (acc[c.category] || 0) + 1;
        return acc;
    }, {});
    console.log('[rag:examples] per format:', perCategory);

    const start = Date.now();
    const { inserted, skipped } = await upsertChunks(chunks);
    const took = ((Date.now() - start) / 1000).toFixed(1);

    const total = await countChunks();
    console.log(
        `[rag:examples] done in ${took}s — upserted=${inserted} skipped=${skipped} source=${EXAMPLE_SOURCE} totalInDb=${total}`,
    );
};

main()
    .catch((err) => {
        console.error('[rag:examples] failed:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
