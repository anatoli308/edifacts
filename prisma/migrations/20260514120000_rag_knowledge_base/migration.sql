-- ============================================================================
-- RAG Knowledge Base — pgvector schema
-- ============================================================================
-- Purpose:
--   Store EDIFACT domain knowledge (code lists, GS1 profiles, user rules) with
--   semantic vector embeddings for retrieval-augmented generation.
--
-- Vector dimensionality:
--   768  (matches Ollama `nomic-embed-text` output)
--
-- Index strategy:
--   HNSW index on `embedding vector_cosine_ops` — best recall/speed tradeoff
--   for production-scale semantic search (vs. ivfflat which needs rebuild
--   after large inserts).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE knowledge_chunks (
    id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    source      text          NOT NULL,            -- e.g. 'EDIFACT_CODE_LIST', 'GS1_PROFILE', 'USER_RULE'
    category    text          NOT NULL,            -- e.g. 'DTM_QUALIFIER', 'RFF_QUALIFIER', 'BGM_TYPE'
    code        text,                              -- exact code if applicable (e.g. '380', 'BY', 'EUR')
    title       text          NOT NULL,
    content     text          NOT NULL,
    metadata    jsonb         NOT NULL DEFAULT '{}'::jsonb,
    embedding   vector(768)   NOT NULL,
    created_at  timestamptz   NOT NULL DEFAULT now(),
    updated_at  timestamptz   NOT NULL DEFAULT now()
);

-- Exact-match lookup paths (fast path before resorting to semantic search)
CREATE INDEX knowledge_chunks_source_idx   ON knowledge_chunks (source);
CREATE INDEX knowledge_chunks_category_idx ON knowledge_chunks (category);
CREATE INDEX knowledge_chunks_code_idx     ON knowledge_chunks (code) WHERE code IS NOT NULL;

-- Idempotent re-seeding key: (source, category, code) must be unique when code is set.
-- For chunks without a code (e.g. long-form profile docs) we fall back to (source, category, title).
CREATE UNIQUE INDEX knowledge_chunks_codekey_uidx
    ON knowledge_chunks (source, category, code)
    WHERE code IS NOT NULL;

CREATE UNIQUE INDEX knowledge_chunks_titlekey_uidx
    ON knowledge_chunks (source, category, title)
    WHERE code IS NULL;

-- Semantic search index (cosine distance). HNSW params m=16, ef_construction=64
-- are pgvector defaults — good general tradeoff; tune later if recall drops.
CREATE INDEX knowledge_chunks_embedding_hnsw
    ON knowledge_chunks
    USING hnsw (embedding vector_cosine_ops);
