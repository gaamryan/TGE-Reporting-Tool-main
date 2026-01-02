/**
 * Email Ingest Edge Function
 *
 * Receives emails with CSV attachments from SendGrid Inbound Parse or Postmark.
 * Extracts CSV files and queues them for processing.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase.ts";

interface SendGridInboundEmail {
  headers: string;
  dkim: string;
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  sender_ip: string;
  spam_report: string;
  envelope: string;
  attachments: string;
  attachment_info: string;
  charsets: string;
}

interface Attachment {
  filename: string;
  type: string;
  content: string; // base64 encoded
}

serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createServiceClient();

    // Parse form data from SendGrid
    const formData = await req.formData();

    // Extract email fields
    const to = formData.get("to") as string;
    const from = formData.get("from") as string;
    const subject = formData.get("subject") as string;
    const text = formData.get("text") as string;

    console.log(`Received email from: ${from}, to: ${to}, subject: ${subject}`);

    // Determine lead source from recipient email
    const { data: leadSource, error: sourceError } = await supabase
      .from("lead_sources")
      .select("*")
      .or(`ingest_email.ilike.%${extractEmailAddress(to)}%`)
      .single();

    if (sourceError || !leadSource) {
      console.warn(`Unknown recipient email: ${to}`);
      // Still process, but mark as generic
    }

    // Extract organization from sender domain or lookup
    let organizationId: string | null = null;

    // Try to find org by sender domain (simplified - in production would be more sophisticated)
    const senderDomain = extractDomain(from);
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .ilike("settings->email_domains", `%${senderDomain}%`)
      .single();

    if (org) {
      organizationId = org.id;
    }

    // Process attachments
    const attachmentInfo = formData.get("attachment-info");
    const attachments: Attachment[] = [];

    if (attachmentInfo) {
      const info = JSON.parse(attachmentInfo as string);

      for (const [key, meta] of Object.entries(info) as [string, { filename: string; type: string }][]) {
        const file = formData.get(key) as File;
        if (file && (meta.filename.endsWith(".csv") || meta.type === "text/csv")) {
          const content = await file.text();
          attachments.push({
            filename: meta.filename,
            type: meta.type,
            content: btoa(content), // base64 encode
          });
        }
      }
    }

    // Also check for direct file attachments
    for (const [key, value] of formData.entries()) {
      if (value instanceof File && (value.name.endsWith(".csv") || value.type === "text/csv")) {
        const content = await value.text();
        attachments.push({
          filename: value.name,
          type: value.type,
          content: btoa(content),
        });
      }
    }

    if (attachments.length === 0) {
      console.log("No CSV attachments found");
      return jsonResponse({
        success: true,
        message: "Email received but no CSV attachments found",
      });
    }

    // Create ingestion records for each CSV
    const ingestions = [];

    for (const attachment of attachments) {
      // Compute file hash for deduplication
      const fileHash = await computeHash(attachment.content);

      // Check for duplicate
      const { data: existing } = await supabase
        .from("raw_ingestions")
        .select("id")
        .eq("file_hash", fileHash)
        .single();

      if (existing) {
        console.log(`Duplicate file detected: ${attachment.filename}`);
        continue;
      }

      // Store file in Supabase Storage
      const storagePath = `ingestions/${Date.now()}_${attachment.filename}`;
      const fileContent = Uint8Array.from(atob(attachment.content), (c) => c.charCodeAt(0));

      const { error: uploadError } = await supabase.storage
        .from("lead-files")
        .upload(storagePath, fileContent, {
          contentType: "text/csv",
        });

      if (uploadError) {
        console.error("Failed to upload file:", uploadError);
      }

      // Create ingestion record
      const { data: ingestion, error: ingestionError } = await supabase
        .from("raw_ingestions")
        .insert({
          lead_source_id: leadSource?.id || null,
          organization_id: organizationId,
          ingest_type: "email",
          file_name: attachment.filename,
          file_url: storagePath,
          file_hash: fileHash,
          email_from: from,
          email_subject: subject,
          email_received_at: new Date().toISOString(),
          status: "pending",
          processing_log: [
            {
              timestamp: new Date().toISOString(),
              action: "email_received",
              details: { from, to, subject },
            },
          ],
        })
        .select()
        .single();

      if (ingestionError) {
        console.error("Failed to create ingestion:", ingestionError);
        continue;
      }

      ingestions.push(ingestion);

      // Trigger CSV parsing (call csv-parser function)
      const parseUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/csv-parser`;

      fetch(parseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ ingestion_id: ingestion.id }),
      }).catch((err) => console.error("Failed to trigger csv-parser:", err));
    }

    return jsonResponse({
      success: true,
      message: `Processed ${ingestions.length} CSV attachment(s)`,
      ingestion_ids: ingestions.map((i) => i.id),
    });
  } catch (error) {
    console.error("Email ingest error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unknown error",
      500
    );
  }
});

/**
 * Extract email address from a formatted email string
 * e.g., "John Doe <john@example.com>" -> "john@example.com"
 */
function extractEmailAddress(email: string): string {
  const match = email.match(/<([^>]+)>/);
  return match ? match[1] : email;
}

/**
 * Extract domain from email address
 */
function extractDomain(email: string): string {
  const addr = extractEmailAddress(email);
  const parts = addr.split("@");
  return parts.length > 1 ? parts[1] : "";
}

/**
 * Compute SHA-256 hash of content
 */
async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
