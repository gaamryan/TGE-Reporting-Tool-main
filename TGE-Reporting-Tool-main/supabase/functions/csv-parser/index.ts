/**
 * CSV Parser Edge Function
 *
 * Parses CSV files based on lead source configuration and creates raw_lead_rows.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { parse } from "https://deno.land/std@0.208.0/csv/parse.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { createServiceClient, LeadSource, RawIngestion } from "../_shared/supabase.ts";

interface ParseRequest {
  ingestion_id: string;
}

serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { ingestion_id } = (await req.json()) as ParseRequest;

    if (!ingestion_id) {
      return errorResponse("Missing ingestion_id", 400);
    }

    const supabase = createServiceClient();

    // Get ingestion record
    const { data: ingestion, error: ingestionError } = await supabase
      .from("raw_ingestions")
      .select("*, lead_sources(*)")
      .eq("id", ingestion_id)
      .single();

    if (ingestionError || !ingestion) {
      return errorResponse("Ingestion not found", 404);
    }

    // Update status to processing
    await supabase
      .from("raw_ingestions")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
        processing_log: [
          ...((ingestion as RawIngestion).processing_log || []),
          { timestamp: new Date().toISOString(), action: "parsing_started" },
        ],
      })
      .eq("id", ingestion_id);

    // Download CSV from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("lead-files")
      .download(ingestion.file_url);

    if (downloadError || !fileData) {
      await updateIngestionError(supabase, ingestion_id, "Failed to download file", ingestion);
      return errorResponse("Failed to download file", 500);
    }

    const csvContent = await fileData.text();

    // Get CSV config from lead source
    const leadSource = ingestion.lead_sources as LeadSource | null;
    const csvConfig = leadSource?.csv_config || {
      delimiter: ",",
      has_header: true,
      skip_rows: 0,
    };

    // Parse CSV
    let rows: Record<string, string>[];
    try {
      const lines = csvContent.split("\n");

      // Skip initial rows if configured
      const dataLines = lines.slice(csvConfig.skip_rows || 0);
      const cleanedCsv = dataLines.join("\n");

      const parsed = parse(cleanedCsv, {
        skipFirstRow: csvConfig.has_header,
        separator: csvConfig.delimiter || ",",
      });

      rows = parsed as Record<string, string>[];
    } catch (parseError) {
      await updateIngestionError(
        supabase,
        ingestion_id,
        `CSV parse error: ${parseError}`,
        ingestion
      );
      return errorResponse("Failed to parse CSV", 500);
    }

    // Update total rows
    await supabase
      .from("raw_ingestions")
      .update({ total_rows: rows.length })
      .eq("id", ingestion_id);

    // Get field mapping and validation rules
    const fieldMapping = leadSource?.field_mapping || getDefaultFieldMapping();
    const validationRules = leadSource?.validation_rules || { required_fields: ["email"] };

    // Process each row
    const rawRows = [];
    let validCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1 + (csvConfig.skip_rows || 0);

      // Validate row
      const { isValid, errors } = validateRow(row, fieldMapping, validationRules);

      if (isValid) {
        validCount++;
      } else {
        errorCount++;
      }

      rawRows.push({
        ingestion_id,
        row_number: rowNumber,
        raw_data: row,
        is_valid: isValid,
        validation_errors: errors,
      });
    }

    // Insert raw rows in batches
    const batchSize = 500;
    for (let i = 0; i < rawRows.length; i += batchSize) {
      const batch = rawRows.slice(i, i + batchSize);
      const { error: insertError } = await supabase.from("raw_lead_rows").insert(batch);

      if (insertError) {
        console.error("Failed to insert rows:", insertError);
      }
    }

    // Update ingestion status
    await supabase
      .from("raw_ingestions")
      .update({
        status: "parsed",
        parsed_rows: rows.length,
        valid_rows: validCount,
        error_rows: errorCount,
        processing_log: [
          ...((ingestion as RawIngestion).processing_log || []),
          {
            timestamp: new Date().toISOString(),
            action: "parsing_completed",
            details: { total: rows.length, valid: validCount, errors: errorCount },
          },
        ],
      })
      .eq("id", ingestion_id);

    // Trigger transformation
    const transformUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/lead-transformer`;

    fetch(transformUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ ingestion_id }),
    }).catch((err) => console.error("Failed to trigger lead-transformer:", err));

    return jsonResponse({
      success: true,
      ingestion_id,
      total_rows: rows.length,
      valid_rows: validCount,
      error_rows: errorCount,
    });
  } catch (error) {
    console.error("CSV parser error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unknown error",
      500
    );
  }
});

/**
 * Validate a row against field mapping and validation rules
 */
function validateRow(
  row: Record<string, string>,
  fieldMapping: Record<string, string[]>,
  validationRules: { required_fields: string[]; email_regex?: string }
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  for (const requiredField of validationRules.required_fields) {
    const possibleColumns = fieldMapping[requiredField] || [requiredField];
    const hasValue = possibleColumns.some((col) => {
      const value = row[col];
      return value && value.trim() !== "";
    });

    if (!hasValue) {
      errors.push(`Missing required field: ${requiredField}`);
    }
  }

  // Validate email format if present
  const emailColumns = fieldMapping["email"] || ["email"];
  for (const col of emailColumns) {
    const email = row[col];
    if (email && email.trim() !== "") {
      const emailRegex = validationRules.email_regex
        ? new RegExp(validationRules.email_regex)
        : /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(email)) {
        errors.push(`Invalid email format: ${email}`);
      }
      break; // Only validate first email found
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
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
 * Update ingestion with error status
 */
async function updateIngestionError(
  supabase: ReturnType<typeof createServiceClient>,
  ingestionId: string,
  errorMessage: string,
  ingestion: RawIngestion
) {
  await supabase
    .from("raw_ingestions")
    .update({
      status: "failed",
      errors: [...(ingestion.errors || []), { timestamp: new Date().toISOString(), error: errorMessage }],
      processing_log: [
        ...(ingestion.processing_log || []),
        { timestamp: new Date().toISOString(), action: "error", error: errorMessage },
      ],
    })
    .eq("id", ingestionId);
}
