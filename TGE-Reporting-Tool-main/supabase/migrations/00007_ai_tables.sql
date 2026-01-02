-- Migration: AI and embeddings infrastructure
-- Description: Conversations, messages, insights, and embedding queue

-- ============================================
-- AI CONVERSATIONS (chat with data)
-- ============================================

create table ai_conversations (
  id uuid primary key default gen_random_uuid(),

  -- Context
  organization_id uuid references organizations(id),
  user_id uuid, -- TGE user

  title text,
  summary text,

  -- Conversation state
  status text default 'active',
  message_count int default 0,

  -- Vector for conversation retrieval
  embedding vector(1536),

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references ai_conversations(id) on delete cascade not null,

  role text not null check (role in ('user', 'assistant', 'system', 'function')),
  content text not null,

  -- Function calling
  function_name text,
  function_args jsonb,
  function_result jsonb,

  -- What data was referenced
  referenced_leads uuid[], -- source_lead_ids
  referenced_fub_leads uuid[], -- fub_lead_ids
  referenced_matches uuid[], -- lead_match_ids

  -- SQL that was generated/executed
  generated_sql text,
  sql_result jsonb,

  -- Token tracking
  prompt_tokens int,
  completion_tokens int,

  -- Vector for message retrieval
  embedding vector(1536),

  created_at timestamptz default now()
);

-- Indexes for AI conversations
create index idx_ai_conversations_org on ai_conversations(organization_id);
create index idx_ai_conversations_user on ai_conversations(user_id);
create index idx_ai_conversations_status on ai_conversations(status);
create index idx_ai_messages_conversation on ai_messages(conversation_id);
create index idx_ai_messages_role on ai_messages(role);

-- Vector indexes for AI retrieval
create index idx_ai_conversations_embedding on ai_conversations
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index idx_ai_messages_embedding on ai_messages
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ============================================
-- AI INSIGHTS (generated summaries, anomalies)
-- ============================================

create table ai_insights (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid references organizations(id),

  -- What generated this
  insight_type text not null check (insight_type in (
    'daily_summary', 'weekly_summary', 'monthly_summary',
    'anomaly_detection', 'trend_analysis', 'recommendation',
    'match_review', 'data_quality'
  )),

  -- Scope
  scope_type text, -- 'organization', 'team', 'source', 'agent'
  scope_id uuid,

  -- Content
  title text not null,
  summary text not null,
  details jsonb,

  -- Time period
  period_start timestamptz,
  period_end timestamptz,

  -- For retrieval
  embedding vector(1536),

  -- Status
  is_read boolean default false,
  is_actionable boolean default false,
  action_taken text,

  created_at timestamptz default now()
);

-- Indexes for AI insights
create index idx_ai_insights_org on ai_insights(organization_id);
create index idx_ai_insights_type on ai_insights(insight_type);
create index idx_ai_insights_unread on ai_insights(organization_id) where is_read = false;
create index idx_ai_insights_embedding on ai_insights
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ============================================
-- EMBEDDINGS QUEUE (for async processing)
-- ============================================

create table embedding_queue (
  id uuid primary key default gen_random_uuid(),

  -- What to embed
  table_name text not null,
  record_id uuid not null,
  text_to_embed text not null,

  -- Status
  status text default 'pending' check (status in (
    'pending', 'processing', 'completed', 'failed'
  )),
  attempts int default 0,
  last_error text,

  -- Result
  embedding vector(1536),

  created_at timestamptz default now(),
  processed_at timestamptz,

  unique(table_name, record_id)
);

-- Indexes for embedding queue
create index idx_embedding_queue_status on embedding_queue(status) where status = 'pending';
create index idx_embedding_queue_table on embedding_queue(table_name, record_id);
