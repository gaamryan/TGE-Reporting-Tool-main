-- Migration: Lead source configuration
-- Description: Configurable lead sources with CSV parsing rules

-- ============================================
-- LEAD SOURCES (Zillow, Realtor.com, etc.)
-- ============================================

create table lead_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, -- 'zillow', 'realtor_com', 'opcity'
  display_name text not null,

  -- CSV parsing configuration
  csv_config jsonb default '{
    "delimiter": ",",
    "has_header": true,
    "date_format": "MM/DD/YYYY",
    "skip_rows": 0
  }',

  -- Column mapping: source column → our field
  field_mapping jsonb not null default '{
    "email": ["email", "Email", "EMAIL", "Consumer Email"],
    "phone": ["phone", "Phone", "PHONE", "Consumer Phone"],
    "first_name": ["first_name", "First Name", "FirstName"],
    "last_name": ["last_name", "Last Name", "LastName"],
    "full_name": ["name", "Name", "Full Name", "Consumer Name"],
    "address": ["property_address", "Address", "Property Address"],
    "city": ["city", "City", "Property City"],
    "state": ["state", "State", "Property State"],
    "zip": ["zip", "Zip", "ZIP", "Postal Code"],
    "lead_type": ["lead_type", "Type", "Inquiry Type"],
    "source_lead_id": ["id", "Lead ID", "lead_id"],
    "source_created_at": ["created", "Created Date", "Date", "Inquiry Date"]
  }',

  -- Validation rules
  validation_rules jsonb default '{
    "required_fields": ["email"],
    "email_regex": "^[^@]+@[^@]+\\.[^@]+$"
  }',

  -- Email ingest config
  ingest_email text unique, -- zillow-leads@ingest.tge-app.com

  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Seed initial sources
insert into lead_sources (slug, display_name, ingest_email) values
  ('zillow', 'Zillow', 'zillow@ingest.tge-app.com'),
  ('realtor_com', 'Realtor.com', 'realtor@ingest.tge-app.com'),
  ('opcity', 'OpCity', 'opcity@ingest.tge-app.com'),
  ('ylopo', 'Ylopo', 'ylopo@ingest.tge-app.com'),
  ('generic', 'Generic Import', 'import@ingest.tge-app.com');

-- Index for email lookup
create index idx_lead_sources_ingest_email on lead_sources(ingest_email) where ingest_email is not null;
