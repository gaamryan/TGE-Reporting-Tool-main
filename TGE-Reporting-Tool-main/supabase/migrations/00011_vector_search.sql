-- Migration: Vector search functions
-- Description: RPC functions for semantic search using pgvector

-- ============================================
-- VECTOR SEARCH FOR SOURCE LEADS
-- ============================================

create or replace function vector_search_source_leads(
  p_organization_id uuid,
  p_embedding vector(1536),
  p_limit int default 10,
  p_threshold float default 0.7
)
returns table (
  id uuid,
  email text,
  first_name text,
  last_name text,
  full_name text,
  property_address text,
  property_city text,
  property_state text,
  lead_type text,
  match_status text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    sl.id,
    sl.email,
    sl.first_name,
    sl.last_name,
    sl.full_name,
    sl.property_address,
    sl.property_city,
    sl.property_state,
    sl.lead_type,
    sl.match_status,
    1 - (sl.embedding <=> p_embedding) as similarity
  from source_leads sl
  where sl.organization_id = p_organization_id
    and sl.embedding is not null
    and 1 - (sl.embedding <=> p_embedding) > p_threshold
  order by sl.embedding <=> p_embedding
  limit p_limit;
end;
$$;

-- ============================================
-- VECTOR SEARCH FOR FUB LEADS
-- ============================================

create or replace function vector_search_fub_leads(
  p_organization_id uuid,
  p_embedding vector(1536),
  p_limit int default 10,
  p_threshold float default 0.7
)
returns table (
  id uuid,
  fub_lead_id bigint,
  email text,
  first_name text,
  last_name text,
  address text,
  city text,
  state text,
  fub_stage text,
  assigned_user_name text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    fl.id,
    fl.fub_lead_id,
    fl.email,
    fl.first_name,
    fl.last_name,
    fl.address,
    fl.city,
    fl.state,
    fl.fub_stage,
    fl.assigned_user_name,
    1 - (fl.embedding <=> p_embedding) as similarity
  from fub_leads fl
  where fl.organization_id = p_organization_id
    and fl.embedding is not null
    and 1 - (fl.embedding <=> p_embedding) > p_threshold
  order by fl.embedding <=> p_embedding
  limit p_limit;
end;
$$;

-- ============================================
-- VECTOR SEARCH FOR AI INSIGHTS
-- ============================================

create or replace function vector_search_insights(
  p_organization_id uuid,
  p_embedding vector(1536),
  p_limit int default 5
)
returns table (
  id uuid,
  insight_type text,
  title text,
  summary text,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    ai.id,
    ai.insight_type,
    ai.title,
    ai.summary,
    ai.period_start,
    ai.period_end,
    ai.created_at,
    1 - (ai.embedding <=> p_embedding) as similarity
  from ai_insights ai
  where ai.organization_id = p_organization_id
    and ai.embedding is not null
  order by ai.embedding <=> p_embedding
  limit p_limit;
end;
$$;

-- ============================================
-- GENERIC VECTOR SEARCH (for embedding queue usage)
-- ============================================

create or replace function vector_search_leads(
  p_table text,
  p_organization_id uuid,
  p_embedding vector(1536),
  p_limit int default 10,
  p_threshold float default 0.7
)
returns table (
  id uuid,
  similarity float,
  data jsonb
)
language plpgsql
as $$
begin
  if p_table = 'source_leads' then
    return query
    select
      sl.id,
      1 - (sl.embedding <=> p_embedding) as similarity,
      jsonb_build_object(
        'email', sl.email,
        'first_name', sl.first_name,
        'last_name', sl.last_name,
        'property_address', sl.property_address,
        'lead_type', sl.lead_type,
        'match_status', sl.match_status
      ) as data
    from source_leads sl
    where sl.organization_id = p_organization_id
      and sl.embedding is not null
      and 1 - (sl.embedding <=> p_embedding) > p_threshold
    order by sl.embedding <=> p_embedding
    limit p_limit;
  elsif p_table = 'fub_leads' then
    return query
    select
      fl.id,
      1 - (fl.embedding <=> p_embedding) as similarity,
      jsonb_build_object(
        'email', fl.email,
        'first_name', fl.first_name,
        'last_name', fl.last_name,
        'address', fl.address,
        'fub_stage', fl.fub_stage,
        'assigned_user_name', fl.assigned_user_name
      ) as data
    from fub_leads fl
    where fl.organization_id = p_organization_id
      and fl.embedding is not null
      and 1 - (fl.embedding <=> p_embedding) > p_threshold
    order by fl.embedding <=> p_embedding
    limit p_limit;
  else
    raise exception 'Unknown table: %', p_table;
  end if;
end;
$$;
