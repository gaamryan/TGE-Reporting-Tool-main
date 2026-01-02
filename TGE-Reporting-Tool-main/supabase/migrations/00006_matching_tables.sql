-- Migration: Matching and attribution tables
-- Description: Lead matches and match candidates for review

-- ============================================
-- LEAD MATCHES (the core attribution table)
-- ============================================

create table lead_matches (
  id uuid primary key default gen_random_uuid(),

  source_lead_id uuid references source_leads(id) on delete cascade not null,
  fub_lead_id uuid references fub_leads(id) on delete cascade not null,

  -- Match details
  match_type text not null check (match_type in (
    'email_exact', 'phone_exact', 'address_exact',
    'email_fuzzy', 'phone_fuzzy', 'address_fuzzy',
    'name_address', 'manual', 'ai_suggested'
  )),
  match_confidence numeric(5,4) not null, -- 0.0000 to 1.0000
  match_details jsonb default '{}', -- what matched, scores, etc.

  -- Who/what made the match
  matched_by text not null check (matched_by in ('system', 'ai', 'manual')),
  matched_by_user_id uuid,

  -- Attribution (denormalized for reporting speed)
  attributed_team_id uuid references teams(id),
  attributed_agent_id uuid references agents(id),

  -- Status
  status text default 'active' check (status in ('active', 'disputed', 'invalidated')),

  -- AI embeddings for the match context
  embedding vector(1536),

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(source_lead_id, fub_lead_id)
);

-- Indexes for lead matches
create index idx_lead_matches_source on lead_matches(source_lead_id);
create index idx_lead_matches_fub on lead_matches(fub_lead_id);
create index idx_lead_matches_team on lead_matches(attributed_team_id);
create index idx_lead_matches_agent on lead_matches(attributed_agent_id);
create index idx_lead_matches_confidence on lead_matches(match_confidence desc);
create index idx_lead_matches_status on lead_matches(status);
create index idx_lead_matches_type on lead_matches(match_type);

-- ============================================
-- MATCH CANDIDATES (for review queue)
-- ============================================

create table match_candidates (
  id uuid primary key default gen_random_uuid(),
  source_lead_id uuid references source_leads(id) on delete cascade not null,
  fub_lead_id uuid references fub_leads(id) on delete cascade not null,

  -- Scoring
  confidence_score numeric(5,4) not null,
  match_reasons jsonb not null, -- detailed breakdown

  -- Review status
  status text default 'pending' check (status in (
    'pending', 'approved', 'rejected', 'expired'
  )),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,

  -- If approved, link to actual match
  lead_match_id uuid references lead_matches(id),

  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '30 days'),

  unique(source_lead_id, fub_lead_id)
);

-- Indexes for match candidates
create index idx_match_candidates_source on match_candidates(source_lead_id);
create index idx_match_candidates_fub on match_candidates(fub_lead_id);
create index idx_match_candidates_status on match_candidates(status);
create index idx_match_candidates_pending on match_candidates(created_at) where status = 'pending';
