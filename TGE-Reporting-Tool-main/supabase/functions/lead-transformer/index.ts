/**
 * Lead Transformer Edge Function
 *
 * Transforms raw_lead_rows into normalized source_leads.
 * Applies field mapping and queues for embedding.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { createServiceClient, LeadSource, RawIngestion } from "../_shared/supabase.ts";
import { queueForEmbedding } from "../_shared/embeddings.ts";

interface TransformRequest {
  ingestion_id: string;
}

serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { ingestion_id } = (await req.json()) as TransformRequest;

    if (!ingestion_id) {
      return errorResponse("Missing ingestion_id", 400);
    }

    const supabase = createServiceClient();

    // Get ingestion with lead source
    const { data: ingestion, error: ingestionError } = await supabase
      .from("raw_ingestions")
      .select("*, lead_sources(*)")
      .eq("id", ingestion_id)
      .single();

    if (ingestionError || !ingestion) {
      return errorResponse("Ingestion not found", 404);
    }

    // Update status
    await supabase
      .from("raw_ingestions")
      .update({
        status: "transforming",
        processing_log: [
          ...((ingestion as RawIngestion).processing_log || []),
          { timestamp: new Date().toISOString(), action: "transformation_started" },
        ],
      })
      .eq("id", ingestion_id);

    // Get valid raw rows
    const { data: rawRows, error: rowsError } = await supabase
      .from("raw_lead_rows")
      .select("*")
      .eq("ingestion_id", ingestion_id)
      .eq("is_valid", true)
      .is("source_lead_id", null);

    if (rowsError) {
      return errorResponse("Failed to fetch raw rows", 500);
    }

    if (!rawRows || rawRows.length === 0) {
      await supabase
        .from("raw_ingestions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", ingestion_id);

      return jsonResponse({ success: true, message: "No rows to transform", leads_created: 0 });
    }

    const leadSource = ingestion.lead_sources as LeadSource | null;
    const fieldMapping = leadSource?.field_mapping || getDefaultFieldMapping();

    let createdCount = 0;
    let duplicateCount = 0;
    const sourceLeadIds: string[] = [];

    // Process each row
    for (const rawRow of rawRows) {
      const rawData = rawRow.raw_data as Record<string, string>;

      // Map fields
      const normalized = mapFields(rawData, fieldMapping);

      // Check for duplicates by email within same org/source
      if (normalized.email) {
        const { data: existing } = await supabase
          .from("source_leads")
          .select("id")
          .eq("organization_id", ingestion.organization_id)
          .eq("email_normalized", normalized.email.toLowerCase().trim())
          .eq("lead_source_id", leadSource?.id || ingestion.lead_source_id)
          .single();

        if (existing) {
          // Mark as duplicate
          await supabase
            .from("raw_lead_rows")
            .update({ is_duplicate: true, duplicate_of: existing.id })
            .eq("id", rawRow.id);

          duplicateCount++;
          continue;
        }
      }

      // Parse source_created_at if present
      let sourceCreatedAt: string | null = null;
      if (normalized.source_created_at) {
        try {
          const parsed = parseDate(normalized.source_created_at, leadSource?.csv_config?.date_format);
          sourceCreatedAt = parsed?.toISOString() || null;
        } catch {
          // Invalid date, leave as null
        }
      }

      // Create source lead
      const { data: sourceLead, error: insertError } = await supabase
        .from("source_leads")
        .insert({
          raw_row_id: rawRow.id,
          ingestion_id,
          lead_source_id: leadSource?.id || ingestion.lead_source_id,
          organization_id: ingestion.organization_id,
          email: normalized.email,
          phone: normalized.phone,
          first_name: normalized.first_name,
          last_name: normalized.last_name,
          full_name: normalized.full_name,
          property_address: normalized.address,
          property_city: normalized.city,
          property_state: normalized.state,
          property_zip: normalized.zip,
          lead_type: normalized.lead_type,
          source_lead_id: normalized.source_lead_id,
          source_created_at: sourceCreatedAt,
          raw_data: rawData,
          match_status: "pending",
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Failed to create source lead:", insertError);
        continue;
      }

      // Update raw row with source_lead_id
      await supabase
        .from("raw_lead_rows")
        .update({ source_lead_id: sourceLead.id })
        .eq("id", rawRow.id);

      // Record lineage
      await supabase.from("data_lineage").insert({
        source_table: "raw_lead_rows",
        source_id: rawRow.id,
        target_table: "source_leads",
        target_id: sourceLead.id,
        operation: "create",
        transformation_type: "normalize",
        transformation_details: { field_mapping: Object.keys(normalized).filter((k) => normalized[k]) },
        performed_by: "function:lead-transformer",
      });

      // Queue for embedding
      const embeddingText = generateEmbeddingText(normalized, leadSource?.display_name || "Unknown");
      await queueForEmbedding(supabase, "source_leads", sourceLead.id, embeddingText);

      sourceLeadIds.push(sourceLead.id);
      createdCount++;
    }

    // Update ingestion stats
    await supabase
      .from("raw_ingestions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        duplicate_rows: (ingestion as RawIngestion).duplicate_rows + duplicateCount,
        processing_log: [
          ...((ingestion as RawIngestion).processing_log || []),
          {
            timestamp: new Date().toISOString(),
            action: "transformation_completed",
            details: { created: createdCount, duplicates: duplicateCount },
          },
        ],
      })
      .eq("id", ingestion_id);

    // Trigger matching for created leads
    if (sourceLeadIds.length > 0) {
      const matchUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/lead-matcher`;

      fetch(matchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ source_lead_ids: sourceLeadIds }),
      }).catch((err) => console.error("Failed to trigger lead-matcher:", err));
    }

    return jsonResponse({
      success: true,
      ingestion_id,
      leads_created: createdCount,
      duplicates_found: duplicateCount,
    });
  } catch (error) {
    console.error("Lead transformer error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unknown error",
      500
    );
  }
});

/**
 * Map raw data fields to normalized fields using field mapping
 */
function mapFields(
  rawData: Record<string, string>,
  fieldMapping: Record<string, string[]>
): Record<string, string | null> {
  const result: Record<string, string | null> = {};

  for (const [targetField, sourceColumns] of Object.entries(fieldMapping)) {
    for (const col of sourceColumns) {
      if (rawData[col] && rawData[col].trim() !== "") {
        result[targetField] = rawData[col].trim();
        break;
      }
    }
    if (!result[targetField]) {
      result[targetField] = null;
    }
  }

  return result;
}

/**
 * Get default field mapping
 */
function getDefaultFieldMapping(): Record<string, string[]> {
  return {
    email: ["email", "Email", "EMAIL", "Consumer Email", "E-mail"],
    phone: ["phone", "Phone", "PHONE", "Consumer Phone", "Phone Number"],
    first_name: ["first_name", "First Name", "FirstName", "First"],
    last_name: ["last_name", "Last Name", "LastName", "Last"],
    full_name: ["name", "Name", "Full Name", "Consumer Name"],
    address: ["property_address", "Address", "Property Address", "Street Address"],
    city: ["city", "City", "Property City"],
    state: ["state", "State", "Property State"],
    zip: ["zip", "Zip", "ZIP", "Postal Code", "Zip Code"],
    lead_type: ["lead_type", "Type", "Inquiry Type", "Lead Type"],
    source_lead_id: ["id", "Lead ID", "lead_id", "ID"],
    source_created_at: ["created", "Created Date", "Date", "Inquiry Date", "Created At"],
  };
}

/**
 * Parse date string with optional format
 */
function parseDate(dateStr: string, format?: string): Date | null {
  if (!dateStr) return null;

  // Try ISO format first
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try common formats
  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // MM-DD-YYYY
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
  ];

  for (const regex of formats) {
    const match = dateStr.match(regex);
    if (match) {
      // Determine order based on format
      if (regex.source.startsWith("^(\\d{4})")) {
        // YYYY-MM-DD
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      } else {
        // MM/DD/YYYY or MM-DD-YYYY
        return new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
      }
    }
  }

  return null;
}

/**
 * Generate embedding text for a lead
 */
function generateEmbeddingText(normalized: Record<string, string | null>, sourceName: string): string {
  const parts = [
    `Lead from ${sourceName}`,
    normalized.first_name && normalized.last_name
      ? `${normalized.first_name} ${normalized.last_name}`
      : normalized.full_name || "",
    normalized.email ? `email: ${normalized.email}` : "",
    normalized.phone ? `phone: ${normalized.phone}` : "",
    normalized.address ? `property: ${normalized.address}` : "",
    normalized.city || "",
    normalized.state || "",
    normalized.zip || "",
    normalized.lead_type ? `type: ${normalized.lead_type}` : "",
  ];

  return parts.filter((p) => p).join(", ");
}
