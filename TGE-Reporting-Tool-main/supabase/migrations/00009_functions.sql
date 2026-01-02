-- Migration: Utility functions and triggers
-- Description: Phone/address normalization, matching functions, embedding text generators

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Normalize phone to digits only
create or replace function normalize_phone(phone text)
returns text language plpgsql immutable as $$
begin
  if phone is null then
    return null;
  end if;
  return regexp_replace(phone, '[^0-9]', '', 'g');
end;
$$;

-- Normalize address for matching
create or replace function normalize_address(addr text)
returns text language plpgsql immutable as $$
declare
  result text;
begin
  if addr is null then
    return null;
  end if;

  result := lower(trim(addr));

  -- Remove common abbreviations variations
  result := regexp_replace(result, '\bstreet\b', 'st', 'g');
  result := regexp_replace(result, '\bavenue\b', 'ave', 'g');
  result := regexp_replace(result, '\bboulevard\b', 'blvd', 'g');
  result := regexp_replace(result, '\bdrive\b', 'dr', 'g');
  result := regexp_replace(result, '\broad\b', 'rd', 'g');
  result := regexp_replace(result, '\blane\b', 'ln', 'g');
  result := regexp_replace(result, '\bcourt\b', 'ct', 'g');
  result := regexp_replace(result, '\bapartment\b', 'apt', 'g');
  result := regexp_replace(result, '\bsuite\b', 'ste', 'g');
  result := regexp_replace(result, '\bnorth\b', 'n', 'g');
  result := regexp_replace(result, '\bsouth\b', 's', 'g');
  result := regexp_replace(result, '\beast\b', 'e', 'g');
  result := regexp_replace(result, '\bwest\b', 'w', 'g');

  -- Remove extra spaces
  result := regexp_replace(result, '\s+', ' ', 'g');

  return result;
end;
$$;

-- ============================================
-- NORMALIZATION TRIGGERS
-- ============================================

-- Trigger to auto-normalize on insert/update for source_leads
create or replace function normalize_source_lead_fields()
returns trigger language plpgsql as $$
begin
  new.phone_normalized := normalize_phone(new.phone);
  new.property_address_normalized := normalize_address(new.property_address);
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_source_leads_normalize
  before insert or update on source_leads
  for each row execute function normalize_source_lead_fields();

-- Trigger to auto-normalize on insert/update for fub_leads
create or replace function normalize_fub_lead_fields()
returns trigger language plpgsql as $$
begin
  new.phone_normalized := normalize_phone(new.phone);
  new.address_normalized := normalize_address(new.address);
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_fub_leads_normalize
  before insert or update on fub_leads
  for each row execute function normalize_fub_lead_fields();

-- ============================================
-- MATCHING FUNCTION
-- ============================================

create or replace function find_fub_matches(
  p_source_lead_id uuid,
  p_max_results int default 5
)
returns table (
  fub_lead_id uuid,
  match_type text,
  confidence numeric,
  match_details jsonb
) language plpgsql as $$
declare
  v_source source_leads%rowtype;
begin
  select * into v_source from source_leads where id = p_source_lead_id;

  if v_source.id is null then
    return;
  end if;

  return query
  with matches as (
    -- Exact email match (highest confidence)
    select
      f.id as fub_lead_id,
      'email_exact'::text as match_type,
      1.0::numeric as confidence,
      jsonb_build_object('matched_email', v_source.email_normalized) as match_details
    from fub_leads f
    where f.organization_id = v_source.organization_id
      and f.email_normalized = v_source.email_normalized
      and v_source.email_normalized is not null
      and v_source.email_normalized != ''

    union all

    -- Exact phone match
    select
      f.id,
      'phone_exact',
      0.95,
      jsonb_build_object('matched_phone', v_source.phone_normalized)
    from fub_leads f
    where f.organization_id = v_source.organization_id
      and f.phone_normalized = v_source.phone_normalized
      and v_source.phone_normalized is not null
      and length(v_source.phone_normalized) >= 10

    union all

    -- Address fuzzy match
    select
      f.id,
      'address_fuzzy',
      similarity(f.address_normalized, v_source.property_address_normalized)::numeric,
      jsonb_build_object(
        'source_address', v_source.property_address_normalized,
        'fub_address', f.address_normalized,
        'similarity', similarity(f.address_normalized, v_source.property_address_normalized)
      )
    from fub_leads f
    where f.organization_id = v_source.organization_id
      and v_source.property_address_normalized is not null
      and v_source.property_address_normalized != ''
      and f.address_normalized is not null
      and f.address_normalized != ''
      and similarity(f.address_normalized, v_source.property_address_normalized) > 0.6
  )
  select distinct on (m.fub_lead_id)
    m.fub_lead_id,
    m.match_type,
    m.confidence,
    m.match_details
  from matches m
  order by m.fub_lead_id, m.confidence desc
  limit p_max_results;
end;
$$;

-- ============================================
-- EMBEDDING TEXT GENERATORS
-- ============================================

create or replace function generate_source_lead_embedding_text(p_lead_id uuid)
returns text language plpgsql as $$
declare
  v_text text;
begin
  select format(
    'Lead from %s: %s %s, email: %s, phone: %s, property: %s %s %s %s, type: %s, received: %s',
    coalesce(ls.display_name, 'unknown source'),
    coalesce(sl.first_name, ''),
    coalesce(sl.last_name, sl.full_name, ''),
    coalesce(sl.email, 'no email'),
    coalesce(sl.phone, 'no phone'),
    coalesce(sl.property_address, ''),
    coalesce(sl.property_city, ''),
    coalesce(sl.property_state, ''),
    coalesce(sl.property_zip, ''),
    coalesce(sl.lead_type, 'unknown'),
    coalesce(sl.source_created_at::text, sl.created_at::text)
  ) into v_text
  from source_leads sl
  left join lead_sources ls on ls.id = sl.lead_source_id
  where sl.id = p_lead_id;

  return v_text;
end;
$$;

create or replace function generate_fub_lead_embedding_text(p_lead_id uuid)
returns text language plpgsql as $$
declare
  v_text text;
begin
  select format(
    'FUB Lead: %s %s, email: %s, phone: %s, address: %s %s %s %s, assigned to: %s, source: %s, stage: %s, created: %s',
    coalesce(first_name, ''),
    coalesce(last_name, ''),
    coalesce(email, 'no email'),
    coalesce(phone, 'no phone'),
    coalesce(address, ''),
    coalesce(city, ''),
    coalesce(state, ''),
    coalesce(zip, ''),
    coalesce(assigned_user_name, 'unassigned'),
    coalesce(fub_source, 'unknown'),
    coalesce(fub_stage, 'unknown'),
    coalesce(fub_created_at::text, created_at::text)
  ) into v_text
  from fub_leads
  where id = p_lead_id;

  return v_text;
end;
$$;

-- ============================================
-- CONVERSATION MESSAGE COUNT TRIGGER
-- ============================================

create or replace function update_conversation_message_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update ai_conversations
    set message_count = message_count + 1, updated_at = now()
    where id = NEW.conversation_id;
  elsif TG_OP = 'DELETE' then
    update ai_conversations
    set message_count = message_count - 1, updated_at = now()
    where id = OLD.conversation_id;
  end if;
  return null;
end;
$$;

create trigger trg_ai_messages_count
  after insert or delete on ai_messages
  for each row execute function update_conversation_message_count();
