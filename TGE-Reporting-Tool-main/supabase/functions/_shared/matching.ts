/**
 * Lead matching utilities
 */

import { SupabaseClient } from "./supabase.ts";

export interface MatchResult {
  fub_lead_id: string;
  match_type: string;
  confidence: number;
  match_details: Record<string, unknown>;
}

export interface MatchCandidate {
  source_lead_id: string;
  fub_lead_id: string;
  confidence_score: number;
  match_reasons: MatchReason[];
}

export interface MatchReason {
  type: string;
  field: string;
  source_value: string | null;
  fub_value: string | null;
  score: number;
  details?: string;
}

/**
 * Confidence thresholds for automatic vs review matching
 */
export const MATCH_THRESHOLDS = {
  AUTO_MATCH: 0.9, // Automatically create match
  REVIEW_THRESHOLD: 0.6, // Add to review queue
  REJECT_THRESHOLD: 0.4, // Below this, don't even suggest
};

/**
 * Find potential FUB matches for a source lead using the database function
 */
export async function findMatches(
  supabase: SupabaseClient,
  sourceLeadId: string,
  maxResults = 5
): Promise<MatchResult[]> {
  const { data, error } = await supabase.rpc("find_fub_matches", {
    p_source_lead_id: sourceLeadId,
    p_max_results: maxResults,
  });

  if (error) {
    throw new Error(`Match query failed: ${error.message}`);
  }

  return (data || []) as MatchResult[];
}

/**
 * Process match results and create matches or candidates
 */
export async function processMatches(
  supabase: SupabaseClient,
  sourceLeadId: string,
  matches: MatchResult[],
  organizationId: string
): Promise<{
  matched: boolean;
  matchId?: string;
  candidatesCreated: number;
}> {
  if (matches.length === 0) {
    // No matches found - mark as unmatched
    await supabase
      .from("source_leads")
      .update({ match_status: "unmatched", matched_at: new Date().toISOString() })
      .eq("id", sourceLeadId);

    return { matched: false, candidatesCreated: 0 };
  }

  // Check for high-confidence automatic match
  const autoMatch = matches.find((m) => m.confidence >= MATCH_THRESHOLDS.AUTO_MATCH);

  if (autoMatch) {
    // Get FUB lead to find assigned agent
    const { data: fubLead } = await supabase
      .from("fub_leads")
      .select("assigned_user_id")
      .eq("id", autoMatch.fub_lead_id)
      .single();

    // Find agent by FUB user ID
    let agentId: string | null = null;
    let teamId: string | null = null;

    if (fubLead?.assigned_user_id) {
      const { data: agent } = await supabase
        .from("agents")
        .select("id, team_id")
        .eq("fub_user_id", fubLead.assigned_user_id)
        .single();

      if (agent) {
        agentId = agent.id;
        teamId = agent.team_id;
      }
    }

    // Create the match
    const { data: match, error: matchError } = await supabase
      .from("lead_matches")
      .insert({
        source_lead_id: sourceLeadId,
        fub_lead_id: autoMatch.fub_lead_id,
        match_type: autoMatch.match_type,
        match_confidence: autoMatch.confidence,
        match_details: autoMatch.match_details,
        matched_by: "system",
        attributed_agent_id: agentId,
        attributed_team_id: teamId,
      })
      .select("id")
      .single();

    if (matchError) {
      throw new Error(`Failed to create match: ${matchError.message}`);
    }

    // Update source lead status
    await supabase
      .from("source_leads")
      .update({
        match_status: "matched",
        match_confidence: autoMatch.confidence,
        matched_at: new Date().toISOString(),
      })
      .eq("id", sourceLeadId);

    // Record lineage
    await supabase.from("data_lineage").insert({
      source_table: "source_leads",
      source_id: sourceLeadId,
      target_table: "lead_matches",
      target_id: match.id,
      operation: "create",
      transformation_type: "match",
      transformation_details: {
        match_type: autoMatch.match_type,
        confidence: autoMatch.confidence,
        auto_matched: true,
      },
      performed_by: "system",
    });

    return { matched: true, matchId: match.id, candidatesCreated: 0 };
  }

  // Create match candidates for review
  const candidates = matches.filter(
    (m) =>
      m.confidence >= MATCH_THRESHOLDS.REJECT_THRESHOLD &&
      m.confidence < MATCH_THRESHOLDS.AUTO_MATCH
  );

  if (candidates.length > 0) {
    const candidateInserts = candidates.map((c) => ({
      source_lead_id: sourceLeadId,
      fub_lead_id: c.fub_lead_id,
      confidence_score: c.confidence,
      match_reasons: [
        {
          type: c.match_type,
          field: c.match_type.replace("_exact", "").replace("_fuzzy", ""),
          score: c.confidence,
          details: c.match_details,
        },
      ],
    }));

    const { error: candidateError } = await supabase
      .from("match_candidates")
      .upsert(candidateInserts, {
        onConflict: "source_lead_id,fub_lead_id",
      });

    if (candidateError) {
      console.error("Failed to create candidates:", candidateError);
    }

    // Update source lead to review status
    await supabase
      .from("source_leads")
      .update({
        match_status: candidates.length > 1 ? "multiple" : "review",
        match_confidence: Math.max(...candidates.map((c) => c.confidence)),
      })
      .eq("id", sourceLeadId);

    return { matched: false, candidatesCreated: candidates.length };
  }

  // Below threshold - mark as unmatched
  await supabase
    .from("source_leads")
    .update({ match_status: "unmatched", matched_at: new Date().toISOString() })
    .eq("id", sourceLeadId);

  return { matched: false, candidatesCreated: 0 };
}

/**
 * Approve a match candidate
 */
export async function approveCandidate(
  supabase: SupabaseClient,
  candidateId: string,
  reviewedBy: string
): Promise<string> {
  // Get the candidate
  const { data: candidate, error: fetchError } = await supabase
    .from("match_candidates")
    .select("*")
    .eq("id", candidateId)
    .single();

  if (fetchError || !candidate) {
    throw new Error("Candidate not found");
  }

  // Get FUB lead for attribution
  const { data: fubLead } = await supabase
    .from("fub_leads")
    .select("assigned_user_id")
    .eq("id", candidate.fub_lead_id)
    .single();

  let agentId: string | null = null;
  let teamId: string | null = null;

  if (fubLead?.assigned_user_id) {
    const { data: agent } = await supabase
      .from("agents")
      .select("id, team_id")
      .eq("fub_user_id", fubLead.assigned_user_id)
      .single();

    if (agent) {
      agentId = agent.id;
      teamId = agent.team_id;
    }
  }

  // Create the match
  const { data: match, error: matchError } = await supabase
    .from("lead_matches")
    .insert({
      source_lead_id: candidate.source_lead_id,
      fub_lead_id: candidate.fub_lead_id,
      match_type: "manual",
      match_confidence: candidate.confidence_score,
      match_details: { reasons: candidate.match_reasons, approved_from_candidate: true },
      matched_by: "manual",
      matched_by_user_id: reviewedBy,
      attributed_agent_id: agentId,
      attributed_team_id: teamId,
    })
    .select("id")
    .single();

  if (matchError) {
    throw new Error(`Failed to create match: ${matchError.message}`);
  }

  // Update candidate
  await supabase
    .from("match_candidates")
    .update({
      status: "approved",
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      lead_match_id: match.id,
    })
    .eq("id", candidateId);

  // Update source lead
  await supabase
    .from("source_leads")
    .update({
      match_status: "matched",
      match_confidence: candidate.confidence_score,
      matched_at: new Date().toISOString(),
    })
    .eq("id", candidate.source_lead_id);

  // Reject other candidates for this source lead
  await supabase
    .from("match_candidates")
    .update({ status: "rejected", reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq("source_lead_id", candidate.source_lead_id)
    .neq("id", candidateId)
    .eq("status", "pending");

  return match.id;
}

/**
 * Reject a match candidate
 */
export async function rejectCandidate(
  supabase: SupabaseClient,
  candidateId: string,
  reviewedBy: string,
  notes?: string
): Promise<void> {
  await supabase
    .from("match_candidates")
    .update({
      status: "rejected",
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      review_notes: notes,
    })
    .eq("id", candidateId);
}
