#!/usr/bin/env bash
# =========================================================================
# Jaxson AI Space Database Dual-Schema Dynamic Initializer
# Injects role credentials securely via psql variables
# =========================================================================

set -euo pipefail

DB_USER="${POSTGRES_USER:?POSTGRES_USER is required}"
DB_NAME="${POSTGRES_DB:?POSTGRES_DB is required}"
OWNER_PASS="${OWNER_APP_PASSWORD:?OWNER_APP_PASSWORD is required}"
PUBLIC_PASS="${PUBLIC_AGENT_PASSWORD:?PUBLIC_AGENT_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 \
     --username "${DB_USER}" \
     --dbname "${DB_NAME}" \
     -v owner_pass="${OWNER_PASS}" \
     -v public_pass="${PUBLIC_PASS}" <<-EOSQL
    -- 1. Enable pgvector & UUID Extensions
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- 2. Create Dual Schemas
    CREATE SCHEMA IF NOT EXISTS owner;
    CREATE SCHEMA IF NOT EXISTS public_read;

    -- 3. Create/Update Security Roles with Secure Variable Values
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'owner_app') THEN
            EXECUTE format('CREATE ROLE owner_app WITH LOGIN PASSWORD %L', :'owner_pass');
        ELSE
            EXECUTE format('ALTER ROLE owner_app WITH PASSWORD %L', :'owner_pass');
        END IF;
    END \$\$;

    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'public_agent') THEN
            EXECUTE format('CREATE ROLE public_agent WITH LOGIN PASSWORD %L', :'public_pass');
        ELSE
            EXECUTE format('ALTER ROLE public_agent WITH PASSWORD %L', :'public_pass');
        END IF;
    END \$\$;

    -- 4. Set Search Paths and Schema Permissions
    ALTER ROLE owner_app SET search_path TO owner, public;
    ALTER ROLE public_agent SET search_path TO public_read;

    GRANT ALL ON SCHEMA owner TO owner_app;
    GRANT CREATE ON SCHEMA owner TO owner_app;
    GRANT ALL ON SCHEMA public_read TO owner_app;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA owner TO owner_app;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA owner TO owner_app;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public_read TO owner_app;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public_read TO owner_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA owner GRANT ALL ON TABLES TO owner_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA owner GRANT ALL ON SEQUENCES TO owner_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public_read GRANT ALL ON TABLES TO owner_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public_read GRANT ALL ON SEQUENCES TO owner_app;

    GRANT USAGE ON SCHEMA public_read TO public_agent;
    GRANT SELECT ON ALL TABLES IN SCHEMA public_read TO public_agent;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public_read GRANT SELECT ON TABLES TO public_agent;

    REVOKE ALL ON SCHEMA owner FROM public_agent;
    REVOKE ALL ON ALL TABLES IN SCHEMA owner FROM public_agent;

    -- 5. Create Public Snapshot & Vector Embeddings Table
    CREATE TABLE IF NOT EXISTS public_read.knowledge_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chunk_id VARCHAR(100) NOT NULL UNIQUE,
        category VARCHAR(50) NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        evidence_tag TEXT NOT NULL,
        embedding vector(1536),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS knowledge_embeddings_cosine_idx 
    ON public_read.knowledge_embeddings 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
EOSQL
