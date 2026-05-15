-- ============================================================================
-- RAG hardening + message feedback
-- ============================================================================
-- Three independent changes bundled into one migration:
--
--   A) knowledge_chunks.user_id     FK -> users(id) ON DELETE CASCADE
--   B) knowledge_chunks.embedding_model
--   C) message_feedback table
--
-- All statements are idempotent so a partial earlier run can be re-applied
-- cleanly after rolling back the migration record.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) user_id FK on knowledge_chunks
-- ---------------------------------------------------------------------------

ALTER TABLE knowledge_chunks
    ADD COLUMN IF NOT EXISTS user_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'knowledge_chunks'
          AND constraint_name = 'knowledge_chunks_user_id_fkey'
    ) THEN
        ALTER TABLE knowledge_chunks
            ADD CONSTRAINT knowledge_chunks_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS knowledge_chunks_user_id_idx
    ON knowledge_chunks (user_id)
    WHERE user_id IS NOT NULL;

-- Backfill: lift existing metadata.userId values into the FK column. Guard
-- with a UUID-shape regex because dev/test fixtures may carry synthetic
-- non-UUID IDs that would crash a naive ::uuid cast.
UPDATE knowledge_chunks
SET user_id = (metadata->>'userId')::uuid
WHERE source = 'USER_MEMORY'
  AND metadata ? 'userId'
  AND user_id IS NULL
  AND metadata->>'userId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- ---------------------------------------------------------------------------
-- B) embedding_model column
-- ---------------------------------------------------------------------------

ALTER TABLE knowledge_chunks
    ADD COLUMN IF NOT EXISTS embedding_model text NOT NULL DEFAULT 'nomic-embed-text';

CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_model_idx
    ON knowledge_chunks (embedding_model);

-- ---------------------------------------------------------------------------
-- C) message_feedback table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS message_feedback (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id          uuid          NOT NULL REFERENCES analysis_messages(id) ON DELETE CASCADE,
    user_id             uuid          NOT NULL REFERENCES users(id)             ON DELETE CASCADE,
    rating              smallint      NOT NULL,
    comment             text          NOT NULL DEFAULT '',
    retrieved_chunk_ids uuid[]        NOT NULL DEFAULT ARRAY[]::uuid[],
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_at          timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT message_feedback_rating_check CHECK (rating IN (-1, 1))
);

CREATE UNIQUE INDEX IF NOT EXISTS message_feedback_message_user_uidx
    ON message_feedback (message_id, user_id);

CREATE INDEX IF NOT EXISTS message_feedback_user_id_idx ON message_feedback (user_id);
CREATE INDEX IF NOT EXISTS message_feedback_rating_idx  ON message_feedback (rating);
