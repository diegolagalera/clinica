-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create additional indexes that might be useful
-- The main schema is managed by Drizzle migrations

-- Useful for full-text search on patient names
CREATE EXTENSION IF NOT EXISTS pg_trgm;
