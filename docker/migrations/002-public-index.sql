-- Idempotent migration for existing production volumes.
BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS public_read;

CREATE TABLE IF NOT EXISTS public_read.knowledge_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    evidence_tag TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}'::jsonb,
    generation_id VARCHAR(100) NOT NULL DEFAULT 'bootstrap',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public_read.knowledge_embeddings
    ADD COLUMN IF NOT EXISTS generation_id VARCHAR(100) NOT NULL DEFAULT 'bootstrap';
ALTER TABLE public_read.knowledge_embeddings
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS knowledge_embeddings_cosine_idx
    ON public_read.knowledge_embeddings USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS knowledge_embeddings_active_idx
    ON public_read.knowledge_embeddings (is_active, updated_at DESC);

CREATE SCHEMA IF NOT EXISTS owner;
CREATE TABLE IF NOT EXISTS owner.outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    title TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    evidence_tag TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT outbox_events_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS outbox_events_pending_idx
    ON owner.outbox_events (status, available_at, created_at);

ALTER TABLE owner.outbox_events
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

GRANT ALL PRIVILEGES ON TABLE public_read.knowledge_embeddings TO owner_app;
GRANT ALL PRIVILEGES ON TABLE owner.outbox_events TO owner_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public_read TO public_agent;

COMMIT;
