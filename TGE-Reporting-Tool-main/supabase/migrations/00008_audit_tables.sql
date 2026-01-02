-- Migration: Audit and lineage tables
-- Description: Data lineage tracking and FUB sync logging

-- ============================================
-- DATA LINEAGE (track transformations)
-- ============================================

create table data_lineage (
  id uuid primary key default gen_random_uuid(),

  -- Source
  source_table text not null,
  source_id uuid not null,

  -- Target
  target_table text not null,
  target_id uuid not null,

  -- Transformation
  operation text not null, -- 'create', 'update', 'merge', 'split', 'derive'
  transformation_type text, -- 'normalize', 'match', 'enrich', 'dedupe'
  transformation_details jsonb,

  -- Who/what did it
  performed_by text not null, -- 'system', 'ai', 'user:{id}', 'function:{name}'

  created_at timestamptz default now()
);

-- Indexes for data lineage
create index idx_lineage_source on data_lineage(source_table, source_id);
create index idx_lineage_target on data_lineage(target_table, target_id);
create index idx_lineage_operation on data_lineage(operation);
create index idx_lineage_created on data_lineage(created_at);

-- ============================================
-- SYNC LOG (FUB polling history)
-- ============================================

create table fub_sync_log (
  id uuid primary key default gen_random_uuid(),
  fub_connection_id uuid references fub_connections(id) on delete cascade,

  sync_type text not null, -- 'full', 'incremental', 'on_demand'
  status text not null,

  -- Stats
  leads_fetched int default 0,
  leads_created int default 0,
  leads_updated int default 0,

  -- Timing
  started_at timestamptz not null,
  completed_at timestamptz,
  duration_ms int,

  -- Errors
  errors jsonb default '[]',

  created_at timestamptz default now()
);

-- Indexes for sync log
create index idx_fub_sync_log_connection on fub_sync_log(fub_connection_id);
create index idx_fub_sync_log_status on fub_sync_log(status);
create index idx_fub_sync_log_started on fub_sync_log(started_at desc);
