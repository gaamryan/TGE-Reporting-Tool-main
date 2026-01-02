import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/utils";
import { WidgetConfig } from "@/types/widget";

/**
 * Chat API Route
 *
 * This handles chat messages and generates widget configurations.
 * In production, this would call the Supabase Edge Function.
 */

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    // For demo purposes, simulate AI responses
    // In production, this would call the ai-query Edge Function

    const lowerMessage = message.toLowerCase();

    // Detect widget generation requests
    if (
      lowerMessage.includes("show me") ||
      lowerMessage.includes("create") ||
      lowerMessage.includes("chart") ||
      lowerMessage.includes("graph")
    ) {
      // Generate a widget based on the request
      const widget = generateWidgetFromMessage(message);

      return NextResponse.json({
        message: `I've created a ${widget.type} chart showing "${widget.title}". Would you like to add it to your dashboard?`,
        widget,
      });
    }

    // Handle questions about data
    if (
      lowerMessage.includes("how many") ||
      lowerMessage.includes("what") ||
      lowerMessage.includes("count")
    ) {
      return NextResponse.json({
        message: generateDataResponse(message),
      });
    }

    // Default response
    return NextResponse.json({
      message:
        "I can help you explore your lead data and create dashboard widgets. Try asking me:\n\n" +
        "- 'Show me leads by source'\n" +
        "- 'Create a chart of match rates'\n" +
        "- 'How many leads came in this week?'\n" +
        "- 'What's our top performing source?'",
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}

function generateWidgetFromMessage(message: string): WidgetConfig {
  const lowerMessage = message.toLowerCase();

  // Detect chart type
  let type: WidgetConfig["type"] = "bar";
  if (lowerMessage.includes("line") || lowerMessage.includes("trend")) {
    type = "line";
  } else if (lowerMessage.includes("pie") || lowerMessage.includes("donut")) {
    type = "donut";
  } else if (lowerMessage.includes("area")) {
    type = "area";
  } else if (lowerMessage.includes("table") || lowerMessage.includes("list")) {
    type = "table";
  }

  // Detect data source/grouping
  let title = "Lead Analysis";
  let xAxis = "name";
  let yAxis = "value";
  let source: WidgetConfig["query"]["source"] = "v_lead_attribution";

  if (lowerMessage.includes("source")) {
    title = "Leads by Source";
    xAxis = "source";
    yAxis = "total_leads";
    source = "v_source_summary";
  } else if (lowerMessage.includes("status") || lowerMessage.includes("match")) {
    title = "Leads by Match Status";
    xAxis = "match_status";
    yAxis = "count";
  } else if (lowerMessage.includes("week")) {
    title = "Leads by Week";
    type = "bar";
    xAxis = "week";
    yAxis = "count";
  } else if (lowerMessage.includes("team")) {
    title = "Leads by Team";
    xAxis = "team";
    yAxis = "total_attributed";
    source = "v_team_summary";
  } else if (lowerMessage.includes("agent")) {
    title = "Leads by Agent";
    xAxis = "agent";
    yAxis = "total_attributed";
    source = "v_agent_summary";
  }

  // Handle specific sources
  if (lowerMessage.includes("zillow")) {
    title = "Zillow Leads";
  } else if (lowerMessage.includes("realtor")) {
    title = "Realtor.com Leads";
  }

  return {
    id: generateId(),
    type,
    title,
    size: "md",
    query: {
      source,
      groupBy: [xAxis],
    },
    visualization: {
      xAxis,
      yAxis,
      showLegend: true,
    },
  };
}

function generateDataResponse(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("today")) {
    return "You received 47 new leads today. That's 12% higher than your daily average. Zillow contributed the most with 23 leads.";
  }

  if (lowerMessage.includes("week")) {
    return "This week you've received 312 leads across all sources:\n\n" +
      "- Zillow: 145 (46%)\n" +
      "- Realtor.com: 89 (29%)\n" +
      "- OpCity: 52 (17%)\n" +
      "- Other: 26 (8%)\n\n" +
      "Your match rate is 73%, up from 68% last week.";
  }

  if (lowerMessage.includes("match rate")) {
    return "Your current match rate is 73.4%. Here's the breakdown:\n\n" +
      "- Matched: 234 leads (73.4%)\n" +
      "- Pending review: 45 leads (14.1%)\n" +
      "- Unmatched: 40 leads (12.5%)\n\n" +
      "The match rate has improved 5.4% over the past 30 days.";
  }

  if (lowerMessage.includes("top") || lowerMessage.includes("best")) {
    return "Zillow is your top performing source with 145 leads this week and an 82% match rate. " +
      "Realtor.com is second with 89 leads and a 71% match rate.";
  }

  return "Based on your data, you have 1,284 total leads with a 73.4% match rate. " +
    "Want me to break this down by source, status, or time period?";
}
