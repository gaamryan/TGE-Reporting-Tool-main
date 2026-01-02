-- Migration: Raw ingestion tables
-- Description: Staging area for incoming data before normalization

-- ============================================
-- RAW INGESTION (staging area)
-- ============================================

create table raw_ingestions (
  id uuid primary key default gen_random_uuid(),

  -- Source identification
  lead_source_id uuid references lead_sources(id),
  organization_id uuid references organizations(id),

  -- Ingest metadata
  ingest_type text not null check (ingest_type in ('email', 'api', 'manual', 'backfill')),
  file_name text,
  file_url text, -- Supabase storage path
  file_hash text, -- MD5 for dedup

  -- Email-specific
  email_from text,
  email_subject text,
  email_received_at timestamptz,

  -- Processing status
  status text default 'pending' check (status in (
    'pending', 'processing', 'parsed', 'transforming',
    'completed', 'failed', 'partial'
  )),

  -- Stats
  total_rows int,
  parsed_rows int default 0,
  valid_rows int default 0,
  duplicate_rows int default 0,
  error_rows int default 0,

  -- Processing log
  processing_log jsonb default '[]',
  errors jsonb default '[]',

  -- Timestamps
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Raw rows from CSV (before normalization)
create table raw_lead_rows (
  id uuid primary key default gen_random_uuid(),
  ingestion_id uuid references raw_ingestions(id) on delete cascade not null,
  row_number int not null,
  raw_data jsonb not null, -- original row as JSON

  -- Parsing status
  is_valid boolean,
  validation_errors jsonb default '[]',
  is_duplicate boolean default false,
  duplicate_of uuid references raw_lead_rows(id),

  -- Link to normalized record
  source_lead_id uuid, -- populated after transformation

  created_at timestamptz default now()
);

-- Indexes for ingestion tables
create index idx_raw_ingestions_org on raw_ingestions(organization_id);
create index idx_raw_ingestions_status on raw_ingestions(status);
create index idx_raw_ingestions_source on raw_ingestions(lead_source_id);
create index idx_raw_lead_rows_ingestion on raw_lead_rows(ingestion_id);
create index idx_raw_lead_rows_valid on raw_lead_rows(ingestion_id) where is_valid = true;
