/**
 * Supabase client utilities for Edge Functions
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type { SupabaseClient };

/**
 * Create a Supabase client with service role key (for server-side operations)
 */
export function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a Supabase client with the user's JWT (for user-scoped operations)
 */
export function createUserClient(authHeader: string | null): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader || "",
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Extract user ID from JWT in authorization header
 */
export async function getUserFromHeader(
  supabase: SupabaseClient,
  authHeader: string | null
): Promise<{ id: string; email: string } | null> {
  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email || "",
  };
}

/**
 * Database types (subset for common operations)
 */
export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  settings: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface LeadSource {
  id: string;
  slug: string;
  display_name: string;
  csv_config: {
    delimiter: string;
    has_header: boolean;
    date_format: string;
    skip_rows: number;
  };
  field_mapping: Record<string, string[]>;
  validation_rules: {
    required_fields: string[];
    email_regex: string;
  };
  ingest_email: string | null;
  is_active: boolean;
}

export interface RawIngestion {
  id: string;
  lead_source_id: string | null;
  organization_id: string | null;
  ingest_type: "email" | "api" | "manual" | "backfill";
  file_name: string | null;
  file_url: string | null;
  file_hash: string | null;
  email_from: string | null;
  email_subject: string | null;
  email_received_at: string | null;
  status: "pending" | "processing" | "parsed" | "transforming" | "completed" | "failed" | "partial";
  total_rows: number | null;
  parsed_rows: number;
  valid_rows: number;
  duplicate_rows: number;
  error_rows: number;
  processing_log: unknown[];
  errors: unknown[];
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SourceLead {
  id: string;
  raw_row_id: string | null;
  ingestion_id: string | null;
  lead_source_id: string;
  organization_id: string;
  email: string | null;
  email_normalized: string | null;
  phone: string | null;
  phone_normalized: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  property_zip: string | null;
  lead_type: string | null;
  source_lead_id: string | null;
  source_created_at: string | null;
  match_status: "pending" | "matched" | "unmatched" | "multiple" | "review";
  match_confidence: number | null;
  matched_at: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface FubLead {
  id: string;
  fub_connection_id: string;
  organization_id: string;
  fub_lead_id: number;
  fub_person_id: number | null;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  assigned_user_id: number | null;
  assigned_user_email: string | null;
  assigned_user_name: string | null;
  fub_source: string | null;
  fub_stage: string | null;
  fub_tags: string[] | null;
  fub_created_at: string | null;
  fub_updated_at: string | null;
  raw_data: Record<string, unknown> | null;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}
