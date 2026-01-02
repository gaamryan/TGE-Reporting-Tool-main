import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { NextRequest } from "next/server";

// Initialize the CopilotKit runtime with OpenAI
const runtime = new CopilotRuntime({
  actions: [
    {
      name: "generateWidget",
      description: "Generate a dashboard widget based on user request. Use this when the user asks to visualize data, create a chart, or add a widget.",
      parameters: [
        {
          name: "type",
          type: "string",
          description: "Widget type: bar, line, area, donut, table, or metric",
          required: true,
        },
        {
          name: "title",
          type: "string",
          description: "Display title for the widget",
          required: true,
        },
        {
          name: "description",
          type: "string",
          description: "Brief description of what the widget shows",
          required: false,
        },
        {
          name: "source",
          type: "string",
          description: "Data source: v_lead_attribution, v_source_summary, v_team_summary, v_agent_summary, source_leads, fub_leads, or lead_matches",
          required: true,
        },
        {
          name: "groupBy",
          type: "string",
          description: "Field to group data by (e.g., source_system, status, created_at)",
          required: false,
        },
        {
          name: "dateRange",
          type: "string",
          description: "Date range preset: today, yesterday, 7d, 30d, 90d, ytd, or all",
          required: false,
        },
        {
          name: "size",
          type: "string",
          description: "Widget size: sm, md, lg, xl, or full. Defaults to md",
          required: false,
        },
      ],
      handler: async (args: { type: string; title: string; description?: string; source: string; groupBy?: string; dateRange?: string; size?: string }) => {
        return {
          id: Math.random().toString(36).substring(7),
          type: args.type,
          title: args.title,
          description: args.description,
          size: args.size || "md",
          query: {
            source: args.source,
            groupBy: args.groupBy ? [args.groupBy] : undefined,
            dateRange: args.dateRange
              ? { field: "created_at", preset: args.dateRange }
              : undefined,
          },
          visualization: {
            xAxis: args.groupBy || "name",
            yAxis: "value",
            showLegend: true,
          },
        };
      },
    },
    {
      name: "queryLeads",
      description: "Query leads with filters",
      parameters: [
        {
          name: "source",
          type: "string",
          description: "Lead source filter",
          required: false,
        },
        {
          name: "status",
          type: "string",
          description: "Match status filter",
          required: false,
        },
        {
          name: "dateFrom",
          type: "string",
          description: "Start date",
          required: false,
        },
        {
          name: "dateTo",
          type: "string",
          description: "End date",
          required: false,
        },
      ],
      handler: async (_args: { source?: string; status?: string; dateFrom?: string; dateTo?: string }) => {
        // In production, this would query Supabase
        return {
          total: 1284,
          matched: 942,
          pending: 234,
          unmatched: 108,
          sources: {
            zillow: 456,
            realtor: 312,
            opcity: 234,
            ylopo: 156,
            other: 126,
          },
        };
      },
    },
  ],
});

const serviceAdapter = new OpenAIAdapter({
  model: "gpt-5.1",
});

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilot",
  });

  return handleRequest(req);
};
