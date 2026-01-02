-- Migration: Reporting views
-- Description: Pre-built views for common queries and reporting

-- ============================================
-- REPORTING VIEWS
-- ============================================

-- Full lead attribution view
create or replace view v_lead_attribution as
select
  sl.id as source_lead_id,
  sl.email,
  sl.phone,
  sl.first_name,
  sl.last_name,
  sl.full_name,
  sl.property_address,
  sl.property_city,
  sl.property_state,
  sl.property_zip,
  sl.lead_type,
  sl.source_created_at,
  sl.match_status,
  sl.match_confidence,

  ls.display_name as lead_source,
  ls.slug as lead_source_slug,

  ri.file_name as import_file,
  ri.created_at as imported_at,

  lm.id as match_id,
  lm.match_type,
  lm.match_confidence as match_score,
  lm.created_at as matched_at,

  fl.id as fub_lead_uuid,
  fl.fub_lead_id,
  fl.fub_stage,
  fl.assigned_user_name as fub_assigned_to,
  fl.assigned_user_email as fub_assigned_email,
  fl.fub_source,
  fl.fub_created_at,

  t.id as team_id,
  t.name as attributed_team,

  a.id as agent_id,
  a.first_name || ' ' || a.last_name as attributed_agent,
  a.email as agent_email,

  o.id as organization_id,
  o.name as organization

from source_leads sl
left join lead_sources ls on ls.id = sl.lead_source_id
left join raw_ingestions ri on ri.id = sl.ingestion_id
left join lead_matches lm on lm.source_lead_id = sl.id and lm.status = 'active'
left join fub_leads fl on fl.id = lm.fub_lead_id
left join teams t on t.id = lm.attributed_team_id
left join agents a on a.id = lm.attributed_agent_id
left join organizations o on o.id = sl.organization_id;

-- Summary by source
create or replace view v_source_summary as
select
  ls.id as lead_source_id,
  ls.slug as source_slug,
  ls.display_name as source,
  o.id as organization_id,
  o.name as organization,
  count(sl.id) as total_leads,
  count(case when sl.match_status = 'matched' then 1 end) as matched_leads,
  count(case when sl.match_status = 'unmatched' then 1 end) as unmatched_leads,
  count(case when sl.match_status = 'pending' then 1 end) as pending_leads,
  count(case when sl.match_status = 'review' then 1 end) as review_leads,
  round(100.0 * count(case when sl.match_status = 'matched' then 1 end) / nullif(count(sl.id), 0), 2) as match_rate,
  min(sl.source_created_at) as earliest_lead,
  max(sl.source_created_at) as latest_lead,
  min(sl.created_at) as first_import,
  max(sl.created_at) as last_import
from lead_sources ls
cross join organizations o
left join source_leads sl on sl.lead_source_id = ls.id and sl.organization_id = o.id
group by ls.id, ls.slug, ls.display_name, o.id, o.name;

-- Summary by team
create or replace view v_team_summary as
select
  t.id as team_id,
  t.name as team,
  o.id as organization_id,
  o.name as organization,
  count(distinct lm.id) as total_attributed,
  count(distinct case when lm.created_at > now() - interval '7 days' then lm.id end) as attributed_last_7_days,
  count(distinct case when lm.created_at > now() - interval '30 days' then lm.id end) as attributed_last_30_days,
  count(distinct a.id) as agent_count,
  count(distinct sl.lead_source_id) as source_count,
  avg(lm.match_confidence) as avg_match_confidence
from teams t
join organizations o on o.id = t.organization_id
left join lead_matches lm on lm.attributed_team_id = t.id and lm.status = 'active'
left join agents a on a.team_id = t.id and a.status = 'active'
left join source_leads sl on sl.id = lm.source_lead_id
group by t.id, t.name, o.id, o.name;

-- Summary by agent
create or replace view v_agent_summary as
select
  a.id as agent_id,
  a.first_name,
  a.last_name,
  a.email,
  t.id as team_id,
  t.name as team,
  o.id as organization_id,
  o.name as organization,
  count(distinct lm.id) as total_attributed,
  count(distinct case when lm.created_at > now() - interval '7 days' then lm.id end) as attributed_last_7_days,
  count(distinct case when lm.created_at > now() - interval '30 days' then lm.id end) as attributed_last_30_days,
  count(distinct sl.lead_source_id) as source_count,
  avg(lm.match_confidence) as avg_match_confidence
from agents a
join teams t on t.id = a.team_id
join organizations o on o.id = t.organization_id
left join lead_matches lm on lm.attributed_agent_id = a.id and lm.status = 'active'
left join source_leads sl on sl.id = lm.source_lead_id
group by a.id, a.first_name, a.last_name, a.email, t.id, t.name, o.id, o.name;

-- Ingestion summary view
create or replace view v_ingestion_summary as
select
  ri.id as ingestion_id,
  ri.ingest_type,
  ri.file_name,
  ri.status,
  ri.total_rows,
  ri.parsed_rows,
  ri.valid_rows,
  ri.duplicate_rows,
  ri.error_rows,
  round(100.0 * ri.valid_rows / nullif(ri.total_rows, 0), 2) as success_rate,
  ls.display_name as lead_source,
  o.name as organization,
  ri.email_from,
  ri.email_subject,
  ri.created_at,
  ri.started_at,
  ri.completed_at,
  extract(epoch from (ri.completed_at - ri.started_at)) as processing_seconds
from raw_ingestions ri
left join lead_sources ls on ls.id = ri.lead_source_id
left join organizations o on o.id = ri.organization_id
order by ri.created_at desc;

-- Match candidates review queue
create or replace view v_match_review_queue as
select
  mc.id as candidate_id,
  mc.confidence_score,
  mc.match_reasons,
  mc.status,
  mc.created_at,
  mc.expires_at,

  sl.email as source_email,
  sl.phone as source_phone,
  sl.first_name as source_first_name,
  sl.last_name as source_last_name,
  sl.property_address as source_address,
  ls.display_name as lead_source,

  fl.email as fub_email,
  fl.phone as fub_phone,
  fl.first_name as fub_first_name,
  fl.last_name as fub_last_name,
  fl.address as fub_address,
  fl.assigned_user_name as fub_assigned_to,

  o.name as organization
from match_candidates mc
join source_leads sl on sl.id = mc.source_lead_id
join fub_leads fl on fl.id = mc.fub_lead_id
join lead_sources ls on ls.id = sl.lead_source_id
join organizations o on o.id = sl.organization_id
where mc.status = 'pending'
order by mc.confidence_score desc, mc.created_at;
