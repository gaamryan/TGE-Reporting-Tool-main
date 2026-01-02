-- Migration: Core entity tables
-- Description: Organizations, teams, agents, and FUB connections

-- ============================================
-- ORGANIZATIONS & TEAMS
-- ============================================

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique, -- url-friendly identifier
  settings jsonb default '{}', -- org-level config
  status text default 'active' check (status in ('active', 'inactive', 'churned')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  external_id text, -- client's internal identifier
  settings jsonb default '{}',
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table agents (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade not null,
  email text not null,
  first_name text,
  last_name text,
  phone text,
  fub_user_id bigint, -- mapped FUB user ID
  external_id text, -- client's agent ID
  status text default 'active',
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(team_id, email)
);

-- ============================================
-- FUB CONNECTIONS
-- ============================================

create table fub_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  fub_account_id bigint not null unique,
  api_key_encrypted text not null, -- store encrypted
  account_name text,
  webhook_secret text,
  sync_config jsonb default '{
    "poll_interval_minutes": 60,
    "sync_leads": true,
    "sync_people": true,
    "sync_deals": false
  }',
  last_sync_at timestamptz,
  last_sync_status text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table team_fub_mappings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  fub_connection_id uuid references fub_connections(id) on delete cascade,
  fub_team_id bigint, -- if FUB has team concept
  created_at timestamptz default now(),
  unique(team_id, fub_connection_id)
);

-- Indexes for core tables
create index idx_teams_org on teams(organization_id);
create index idx_agents_team on agents(team_id);
create index idx_agents_fub_user on agents(fub_user_id) where fub_user_id is not null;
create index idx_fub_connections_org on fub_connections(organization_id);
