-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create additional indexes that might be useful
-- The main schema is managed by Drizzle migrations

-- Useful for full-text search on patient names
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Useful for accent-insensitive search
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create central database for multi-tenant routing
-- This DB stores: superadmins, tenants, global_users
SELECT 'CREATE DATABASE cuspia_central'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cuspia_central')\gexec
