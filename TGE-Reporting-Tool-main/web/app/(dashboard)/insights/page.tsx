"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, TrendingUp, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

const insights = [
  {
    id: "1",
    type: "daily_summary",
    title: "Strong week for Zillow leads",
    summary:
      "Zillow leads are up 23% this week compared to last week. Match rate remains strong at 78%. Consider allocating more resources to handle the increased volume.",
    isActionable: true,
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  },
  {
    id: "2",
    type: "anomaly_detection",
    title: "Unusual drop in Realtor.com leads",
    summary:
      "Realtor.com lead volume dropped 45% yesterday compared to the 7-day average. This may indicate an issue with the CSV import or a change in the source feed.",
    isActionable: true,
    isRead: false,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
  },
  {
    id: "3",
    type: "data_quality",
    title: "89 leads missing phone numbers",
    summary:
      "Found 89 leads imported this week without phone numbers. This may affect match accuracy. Consider requesting phone data from these sources.",
    isActionable: false,
    isRead: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
  },
  {
    id: "4",
    type: "trend_analysis",
    title: "Match rate improving",
    summary:
      "Overall match rate has improved from 68% to 73% over the past 30 days. The new fuzzy address matching algorithm appears to be working well.",
    isActionable: false,
    isRead: true,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
  },
  {
    id: "5",
    type: "recommendation",
    title: "Review pending matches",
    summary:
      "You have 89 matches pending review, some dating back 14 days. Reviewing these promptly ensures accurate attribution for your team.",
    isActionable: true,
    isRead: true,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
  },
];

const typeIcons: Record<string, typeof Lightbulb> = {
  daily_summary: TrendingUp,
  anomaly_detection: AlertTriangle,
  data_quality: CheckCircle,
  trend_analysis: TrendingUp,
  recommendation: Lightbulb,
};

const typeColors: Record<string, "blue" | "yellow" | "green" | "purple"> = {
  daily_summary: "blue",
  anomaly_detection: "yellow",
  data_quality: "green",
  trend_analysis: "purple",
  recommendation: "blue",
};

const badgeVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  blue: "default",
  yellow: "secondary",
  green: "secondary",
  purple: "secondary",
};

export default function InsightsPage() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">AI Insights</h1>
          <p className="text-muted-foreground">
            Automated analysis and recommendations for your data
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Mark All Read</Button>
          <Button>Generate New Insights</Button>
        </div>
      </div>

      {/* Insights list */}
      <div className="space-y-4">
        {insights.map((insight) => {
          const Icon = typeIcons[insight.type] || Lightbulb;
          const color = typeColors[insight.type] || "blue";

          return (
            <Card
              key={insight.id}
              className={insight.isRead ? "opacity-75" : ""}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div
                    className={`p-2 rounded-lg ${
                      color === "blue"
                        ? "bg-blue-100 text-blue-600"
                        : color === "yellow"
                        ? "bg-yellow-100 text-yellow-600"
                        : color === "green"
                        ? "bg-green-100 text-green-600"
                        : "bg-purple-100 text-purple-600"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{insight.title}</h3>
                      {!insight.isRead && (
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{insight.summary}</p>
                    <div className="flex items-center gap-4">
                      <Badge variant={badgeVariants[color]}>
                        {insight.type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </Badge>
                      {insight.isActionable && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Action Needed</Badge>
                      )}
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span className="text-xs">
                          {formatRelativeTime(insight.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {insight.isActionable && (
                    <Button variant="outline" size="sm">
                      Take Action
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
