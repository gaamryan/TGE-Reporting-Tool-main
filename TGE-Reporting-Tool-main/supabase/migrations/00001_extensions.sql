-- Migration: Enable required PostgreSQL extensions
-- Description: Sets up pgvector for embeddings and fuzzy matching extensions

-- Enable extensions
create extension if not exists vector;        -- pgvector for embeddings
create extension if not exists pg_trgm;       -- fuzzy text matching
create extension if not exists fuzzystrmatch; -- soundex, levenshtein for name matching
