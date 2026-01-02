"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { ChatInterface } from "@/components/chat/chat-interface";
import { WidgetConfig } from "@/types/widget";
import { Button } from "@/components/ui/button";
import { generateId } from "@/lib/utils";
import { MessageSquare, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Default widgets configuration (data will be fetched from Supabase)
const defaultWidgets: WidgetConfig[] = [
  {
    id: "leads-by-source",
    type: "bar",
    title: "Leads by Source",
    description: "This week",
    size: "md",
    query: {
      source: "v_source_summary",
      groupBy: ["source"],
    },
    visualization: {
      xAxis: "source",
      yAxis: "total_leads",
      colors: ["blue"],
    },
  },
  {
    id: "match-rate",
    type: "donut",
    title: "Match Status",
    size: "sm",
    query: {
      source: "v_lead_attribution",
      groupBy: ["match_status"],
    },
    visualization: {
      xAxis: "match_status",
      yAxis: "count",
      colors: ["green", "yellow", "red", "gray"],
    },
  },
  {
    id: "leads-trend",
    type: "area",
    title: "Lead Volume Trend",
    description: "Last 30 days",
    size: "lg",
    query: {
      source: "v_lead_attribution",
      groupBy: ["date"],
      dateRange: { field: "source_created_at", preset: "30d" },
    },
    visualization: {
      xAxis: "date",
      yAxis: "count",
      showLegend: false,
    },
  },
];

// Summary metrics state type
interface SummaryMetrics {
  totalLeads: number;
  matchRate: number;
  pendingReview: number;
  activeSources: number;
  leadsTrend: number;
  matchTrend: number;
  pendingTrend: number;
}

export default function DashboardPage() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(defaultWidgets);
  const [showChat, setShowChat] = useState(true);
  const [metrics, setMetrics] = useState<SummaryMetrics>({
    totalLeads: 0,
    matchRate: 0,
    pendingReview: 0,
    activeSources: 0,
    leadsTrend: 0,
    matchTrend: 0,
    pendingTrend: 0,
  });
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);

  // Fetch summary metrics from Supabase
  const fetchMetrics = useCallback(async () => {
    setIsLoadingMetrics(true);
    const supabase = createClient();

    try {
      // Fetch total leads count
      const { count: totalLeads } = await supabase
        .from("source_leads")
        .select("*", { count: "exact", head: true });

      // Fetch matched leads count
      const { count: matchedLeads } = await supabase
        .from("lead_matches")
        .select("*", { count: "exact", head: true });

      // Fetch pending review count
      const { count: pendingReview } = await supabase
        .from("v_match_review_queue")
        .select("*", { count: "exact", head: true });

      // Fetch active sources count
      const { data: sources } = await supabase
        .from("v_source_summary")
        .select("source");

      const matchRate = totalLeads && totalLeads > 0
        ? ((matchedLeads || 0) / totalLeads) * 100
        : 0;

      setMetrics({
        totalLeads: totalLeads || 0,
        matchRate: Math.round(matchRate * 10) / 10,
        pendingReview: pendingReview || 0,
        activeSources: sources?.length || 0,
        leadsTrend: 0, // Would need historical data to calculate
        matchTrend: 0,
        pendingTrend: 0,
      });
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
    } finally {
      setIsLoadingMetrics(false);
    }
  }, []);

  // Fetch metrics on mount
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const handleAddWidget = useCallback((widget: WidgetConfig) => {
    const newWidget = { ...widget, id: generateId() };
    setWidgets((prev) => [...prev, newWidget]);
  }, []);

  const handleRemoveWidget = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }, []);

  return (
    <div className="flex h-full">
      {/* Main dashboard area */}
      <div className="flex-1 p-6 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor your lead performance and attribution
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={fetchMetrics}
              disabled={isLoadingMetrics}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingMetrics ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant={showChat ? "default" : "outline"}
              onClick={() => setShowChat(!showChat)}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              AI Assistant
            </Button>
          </div>
        </div>

        {/* Summary metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border-t-4 border-t-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {isLoadingMetrics ? "..." : metrics.totalLeads.toLocaleString()}
                </span>
                {metrics.totalLeads === 0 && !isLoadingMetrics && (
                  <Badge variant="secondary" className="text-muted-foreground">No data</Badge>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-t-4 border-t-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Match Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {isLoadingMetrics ? "..." : `${metrics.matchRate}%`}
                </span>
                {metrics.totalLeads === 0 && !isLoadingMetrics && (
                  <Badge variant="secondary" className="text-muted-foreground">No data</Badge>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-t-4 border-t-yellow-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {isLoadingMetrics ? "..." : metrics.pendingReview.toLocaleString()}
                </span>
                {metrics.pendingReview === 0 && !isLoadingMetrics && (
                  <Badge variant="secondary" className="text-muted-foreground">None</Badge>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-t-4 border-t-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {isLoadingMetrics ? "..." : metrics.activeSources}
                </span>
                {metrics.activeSources === 0 && !isLoadingMetrics && (
                  <Badge variant="secondary" className="text-muted-foreground">None</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Widget grid */}
        <DashboardGrid
          widgets={widgets}
          onWidgetsChange={setWidgets}
          onRemoveWidget={handleRemoveWidget}
        />
      </div>

      {/* Chat sidebar */}
      {showChat && (
        <div className="w-96 border-l bg-card flex-none">
          <ChatInterface onAddWidget={handleAddWidget} className="h-full rounded-none border-0" />
        </div>
      )}
    </div>
  );
}
