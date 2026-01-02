/**
 * Lead Matcher Edge Function
 *
 * Matches source_leads against fub_leads using multiple signals.
 * Creates lead_matches for high-confidence matches or match_candidates for review.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { findMatches, processMatches, MATCH_THRESHOLDS } from "../_shared/matching.ts";

interface MatchRequest {
  source_lead_ids?: string[];
  organization_id?: string;
  batch_size?: number;
}

serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = (await req.json()) as MatchRequest;
    const supabase = createServiceClient();

    let sourceLeadIds: string[] = [];

    if (body.source_lead_ids && body.source_lead_ids.length > 0) {
      // Process specific leads
      sourceLeadIds = body.source_lead_ids;
    } else if (body.organization_id) {
      // Process all pending leads for an organization
      const { data: pendingLeads, error } = await supabase
        .from("source_leads")
        .select("id")
        .eq("organization_id", body.organization_id)
        .eq("match_status", "pending")
        .limit(body.batch_size || 100);

      if (error) {
        return errorResponse("Failed to fetch pending leads", 500);
      }

      sourceLeadIds = (pendingLeads || []).map((l) => l.id);
    } else {
      // Process all pending leads (cron job mode)
      const { data: pendingLeads, error } = await supabase
        .from("source_leads")
        .select("id, organization_id")
        .eq("match_status", "pending")
        .limit(body.batch_size || 100);

      if (error) {
        return errorResponse("Failed to fetch pending leads", 500);
      }

      sourceLeadIds = (pendingLeads || []).map((l) => l.id);
    }

    if (sourceLeadIds.length === 0) {
      return jsonResponse({
        success: true,
        message: "No pending leads to match",
        processed: 0,
      });
    }

    // Process each lead
    const results = {
      processed: 0,
      matched: 0,
      unmatched: 0,
      review: 0,
      errors: 0,
    };

    for (const sourceLeadId of sourceLeadIds) {
      try {
        // Get source lead
        const { data: sourceLead, error: leadError } = await supabase
          .from("source_leads")
          .select("id, organization_id")
          .eq("id", sourceLeadId)
          .single();

        if (leadError || !sourceLead) {
          results.errors++;
          continue;
        }

        // Find matches using database function
        const matches = await findMatches(supabase, sourceLeadId);

        // Process matches
        const result = await processMatches(
          supabase,
          sourceLeadId,
          matches,
          sourceLead.organization_id
        );

        results.processed++;

        if (result.matched) {
          results.matched++;
        } else if (result.candidatesCreated > 0) {
          results.review++;
        } else {
          results.unmatched++;
        }
      } catch (err) {
        console.error(`Error matching lead ${sourceLeadId}:`, err);
        results.errors++;
      }
    }

    return jsonResponse({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Lead matcher error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unknown error",
      500
    );
  }
});
