-- Migration: Normalized lead tables with vector support
-- Description: Source leads and FUB leads with embeddings

-- ============================================
-- SOURCE LEADS (normalized from CSVs)
-- ============================================

create table source_leads (
  id uuid primary key default gen_random_uuid(),

  -- Lineage
  raw_row_id uuid references raw_lead_rows(id),
  ingestion_id uuid references raw_ingestions(id),
  lead_source_id uuid references lead_sources(id) not null,
  organization_id uuid references organizations(id) not null,

  -- Normalized contact info
  email text,
  email_normalized text generated always as (lower(trim(email))) stored,
  phone text,
  phone_normalized text, -- stripped to digits, populated by trigger
  first_name text,
  last_name text,
  full_name text,

  -- Property info (for address matching)
  property_address text,
  property_address_normalized text, -- standardized, populated by function
  property_city text,
  property_state text,
  property_zip text,

  -- Lead metadata
  lead_type text, -- buyer, seller, renter
  source_lead_id text, -- ID from source system
  source_created_at timestamptz,

  -- Matching
  match_status text default 'pending' check (match_status in (
    'pending', 'matched', 'unmatched', 'multiple', 'review'
  )),
  match_confidence numeric(5,4), -- 0.0000 to 1.0000
  matched_at timestamptz,

  -- AI/Vector
  embedding vector(1536), -- OpenAI text-embedding-3-small
  embedding_text text, -- the text that was embedded
  embedded_at timestamptz,

  -- Raw preservation
  raw_data jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for matching
create index idx_source_leads_email on source_leads(email_normalized) where email_normalized is not null;
create index idx_source_leads_phone on source_leads(phone_normalized) where phone_normalized is not null;
create index idx_source_leads_address on source_leads using gin (property_address_normalized gin_trgm_ops);
create index idx_source_leads_org on source_leads(organization_id);
create index idx_source_leads_source on source_leads(lead_source_id);
create index idx_source_leads_status on source_leads(match_status);
create index idx_source_leads_ingestion on source_leads(ingestion_id);

-- Vector index for semantic search
create index idx_source_leads_embedding on source_leads
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ============================================
-- FUB LEADS (synced from Follow Up Boss)
-- ============================================

create table fub_leads (
  id uuid primary key default gen_random_uuid(),
  fub_connection_id uuid references fub_connections(id) on delete cascade not null,
  organization_id uuid references organizations(id) not null,

  -- FUB identifiers
  fub_lead_id bigint not null,
  fub_person_id bigint,

  -- Contact info
  email text,
  email_normalized text generated always as (lower(trim(email))) stored,
  phone text,
  phone_normalized text,
  first_name text,
  last_name text,

  -- Address
  address text,
  address_normalized text,
  city text,
  state text,
  zip text,

  -- Assignment
  assigned_user_id bigint,
  assigned_user_email text,
  assigned_user_name text,

  -- FUB metadata
  fub_source text,
  fub_source_url text,
  fub_stage text,
  fub_tags text[],
  fub_created_at timestamptz,
  fub_updated_at timestamptz,

  -- AI/Vector
  embedding vector(1536),
  embedding_text text,
  embedded_at timestamptz,

  -- Sync tracking
  raw_data jsonb,
  last_synced_at timestamptz default now(),
  sync_hash text, -- to detect changes

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(fub_connection_id, fub_lead_id)
);

-- Indexes for FUB leads
create index idx_fub_leads_email on fub_leads(email_normalized) where email_normalized is not null;
create index idx_fub_leads_phone on fub_leads(phone_normalized) where phone_normalized is not null;
create index idx_fub_leads_address on fub_leads using gin (address_normalized gin_trgm_ops);
create index idx_fub_leads_org on fub_leads(organization_id);
create index idx_fub_leads_fub_id on fub_leads(fub_lead_id);
create index idx_fub_leads_connection on fub_leads(fub_connection_id);
create index idx_fub_leads_assigned on fub_leads(assigned_user_id) where assigned_user_id is not null;

-- Vector index for FUB leads
create index idx_fub_leads_embedding on fub_leads
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
