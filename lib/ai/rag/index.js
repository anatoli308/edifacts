/**
 * RAG module — public API
 * =======================
 * Single import surface for the rest of the codebase.
 *
 *   import { hybridSearch, searchSemantic, searchExact } from '@/lib/ai/rag';
 *
 * Embedding + writer surfaces are exposed for the seed script and for any
 * future ingestion pipelines (user-uploaded rules, custom code lists, etc.).
 */

export { embed, embedBatch, getEmbeddingDim } from './embedder.js';
export { searchExact, searchSemantic, hybridSearch } from './retriever.js';
export { upsertChunks, countChunks, deleteBySource, deleteByMetadata, deleteByUserId } from './writer.js';
export { getAllChunks } from './knowledgeBase.js';
export { getAllExampleChunks, EXAMPLE_SOURCE } from './exampleLoader.js';
