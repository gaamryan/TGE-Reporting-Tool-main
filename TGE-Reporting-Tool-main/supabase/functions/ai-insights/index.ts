/**
 * AI Insights Edge Function
 *
 * Generates automated insights, summaries, and anomaly detection.
 * Designed to be called on a cron schedule (daily/weekly).
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { chatCompletion, generateEmbedding, formatPgVector } from "../_shared/openai.ts";

interface InsightsRequest {
  organization_id?: string;
  insight_type?: "daily_summary" | "weekly_summary" | "anomaly_detection" | "data_quality";
}

serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = (await req.json().catch(() => ({}))) as InsightsRequest;
    const supabase = createServiceClient();

    // Get organizations to process
    let orgsQuery = supabase.from("organizations").select("id, name").eq("status", "active");

    if (body.organization_id) {
      orgsQuery = orgsQuery.eq("id", body.organization_id);
    }

    const { data: organizations, error: orgsError } = await orgsQuery;

    if (orgsError || !organizations || organizations.length === 0) {
      return jsonResponse({ success: true, message: "No organizations to process" });
    }

    const insightType = body.insight_type || "daily_summary";
    const insights: Array<{ organization: string; insight_id: string }> = [];

    for (const org of organizations) {
      try {
        const insight = await generateInsight(supabase, org.id, org.name, insightType);
        if (insight) {
          insights.push({ organization: org.name, insight_id: insight.id });
        }
      } catch (err) {
        console.error(`Error generating insight for ${org.name}:`, err);
      }
    }

    return jsonResponse({
      success: true,
      insights_generated: insights.length,
      insights,
    });
  } catch (error) {
    console.error("AI insights error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unknown error",
      500
    );
  }
});

/**
 * Generate an insight for an organization
 */
async function generateInsight(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  organizationName: string,
  insightType: string
): Promise<{ id: string } | null> {
  // Gather data based on insight type
  const data = await gatherInsightData(supabase, organizationId, insightType);

  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  // Generate insight using AI
  const prompt = buildInsightPrompt(organizationName, insightType, data);

  const response = await chatCompletion([
    {
      role: "system",
      content: `You are a data analyst for a real estate lead management platform.
Generate concise, actionable insights based on the provided data.
Format your response as JSON with "title" and "summary" fields.
The title should be attention-grabbing but professional.
The summary should be 2-4 sentences highlighting the most important findings.`,
    },
    {
      role: "user",
      content: prompt,
    },
  ], {
    temperature: 0.7,
    max_tokens: 500,
  });

  // Parse AI response
  let title = `${insightType.replace("_", " ")} for ${organizationName}`;
  let summary = response.message.content;

  try {
    const parsed = JSON.parse(response.message.content);
    title = parsed.title || title;
    summary = parsed.summary || summary;
  } catch {
    // Use raw content if not JSON
  }

  // Determine period
  const periodEnd = new Date();
  const periodStart = new Date();

  if (insightType === "daily_summary") {
    periodStart.setDate(periodStart.getDate() - 1);
  } else if (insightType === "weekly_summary") {
    periodStart.setDate(periodStart.getDate() - 7);
  }

  // Generate embedding for the insight
  const embeddingText = `${title}. ${summary}`;
  const embedding = await generateEmbedding(embeddingText);

  // Save insight
  const { data: insight, error } = await supabase
    .from("ai_insights")
    .insert({
      organization_id: organizationId,
      insight_type: insightType,
      scope_type: "organization",
      scope_id: organizationId,
      title,
      summary,
      details: data,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      embedding: formatPgVector(embedding),
      is_actionable: detectActionable(data, insightType),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to save insight:", error);
    return null;
  }

  return insight;
}

/**
 * Gather data for insight generation
 */
async function gatherInsightData(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  insightType: string
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};

  // Get date range
  const endDate = new Date();
  const startDate = new Date();

  if (insightType === "daily_summary") {
    startDate.setDate(startDate.getDate() - 1);
  } else if (insightType === "weekly_summary") {
    startDate.setDate(startDate.getDate() - 7);
  }

  // Get lead counts by source
  const { data: sourceSummary } = await supabase
    .from("v_source_summary")
    .select("*")
    .eq("organization_id", organizationId);

  data.source_summary = sourceSummary;

  // Get recent ingestions
  const { data: recentIngestions } = await supabase
    .from("raw_ingestions")
    .select("id, file_name, status, total_rows, valid_rows, error_rows, created_at")
    .eq("organization_id", organizationId)
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: false })
    .limit(10);

  data.recent_ingestions = recentIngestions;

  // Get match statistics
  const { data: matchStats } = await supabase
    .from("source_leads")
    .select("match_status")
    .eq("organization_id", organizationId)
    .gte("created_at", startDate.toISOString());

  if (matchStats) {
    const statusCounts = matchStats.reduce((acc, lead) => {
      acc[lead.match_status] = (acc[lead.match_status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    data.match_statistics = {
      total: matchStats.length,
      by_status: statusCounts,
      match_rate: matchStats.length > 0
        ? ((statusCounts["matched"] || 0) / matchStats.length * 100).toFixed(1) + "%"
        : "N/A",
    };
  }

  // Get pending review count
  const { count: pendingReviews } = await supabase
    .from("match_candidates")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  data.pending_reviews = pendingReviews || 0;

  // For anomaly detection, get comparison data
  if (insightType === "anomaly_detection") {
    const previousStart = new Date(startDate);
    const previousEnd = new Date(startDate);
    previousStart.setDate(previousStart.getDate() - 7);

    const { data: previousPeriod } = await supabase
      .from("source_leads")
      .select("id")
      .eq("organization_id", organizationId)
      .gte("created_at", previousStart.toISOString())
      .lt("created_at", previousEnd.toISOString());

    data.previous_period_leads = previousPeriod?.length || 0;
    data.current_period_leads = matchStats?.length || 0;

    // Calculate change
    const prevCount = data.previous_period_leads as number;
    const currCount = data.current_period_leads as number;

    if (prevCount > 0) {
      const change = ((currCount - prevCount) / prevCount * 100).toFixed(1);
      data.period_change = `${change}%`;
    }
  }

  // For data quality, check for issues
  if (insightType === "data_quality") {
    // Check for leads with missing emails
    const { count: missingEmails } = await supabase
      .from("source_leads")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("email", null);

    data.missing_emails = missingEmails || 0;

    // Check for failed ingestions
    const { count: failedIngestions } = await supabase
      .from("raw_ingestions")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "failed")
      .gte("created_at", startDate.toISOString());

    data.failed_ingestions = failedIngestions || 0;

    // Check for high error rates
    const { data: errorRates } = await supabase
      .from("raw_ingestions")
      .select("file_name, total_rows, error_rows")
      .eq("organization_id", organizationId)
      .gt("error_rows", 0)
      .gte("created_at", startDate.toISOString());

    data.ingestions_with_errors = errorRates;
  }

  return data;
}

/**
 * Build the prompt for insight generation
 */
function buildInsightPrompt(
  orgName: string,
  insightType: string,
  data: Record<string, unknown>
): string {
  const dataStr = JSON.stringify(data, null, 2);

  switch (insightType) {
    case "daily_summary":
      return `Generate a daily summary for ${orgName} based on this data:\n${dataStr}\n\nFocus on: new leads received, match rates, and any notable changes.`;

    case "weekly_summary":
      return `Generate a weekly summary for ${orgName} based on this data:\n${dataStr}\n\nFocus on: weekly trends, top performing sources, and areas for improvement.`;

    case "anomaly_detection":
      return `Analyze this data for ${orgName} and identify any anomalies or unusual patterns:\n${dataStr}\n\nLook for: unusual volume changes, unexpected source performance, or data quality issues.`;

    case "data_quality":
      return `Generate a data quality report for ${orgName} based on this data:\n${dataStr}\n\nFocus on: missing data, failed imports, and recommendations for improvement.`;

    default:
      return `Generate insights for ${orgName}:\n${dataStr}`;
  }
}

/**
 * Determine if insight requires action
 */
function detectActionable(data: Record<string, unknown>, insightType: string): boolean {
  if (insightType === "data_quality") {
    return (data.missing_emails as number > 10) ||
           (data.failed_ingestions as number > 0) ||
           (data.ingestions_with_errors as unknown[] || []).length > 0;
  }

  if (insightType === "anomaly_detection") {
    const change = parseFloat((data.period_change as string || "0").replace("%", ""));
    return Math.abs(change) > 30; // More than 30% change
  }

  return (data.pending_reviews as number > 50);
}
