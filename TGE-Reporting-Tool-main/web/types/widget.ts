/**
 * Widget System Types
 *
 * Widgets are AI-generated dashboard components that visualize data.
 * The AI generates WidgetConfig objects which are rendered by the WidgetRenderer.
 */

export type WidgetType =
  | "bar"
  | "line"
  | "area"
  | "donut"
  | "table"
  | "metric"
  | "list"
  | "sparkline";

export type WidgetSize = "sm" | "md" | "lg" | "xl" | "full";

export type AggregationType = "count" | "sum" | "avg" | "min" | "max";

export interface WidgetFilter {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "like" | "ilike";
  value: string | number | boolean | string[];
}

export interface WidgetQuery {
  /** Database view or table to query */
  source:
    | "v_lead_attribution"
    | "v_source_summary"
    | "v_team_summary"
    | "v_agent_summary"
    | "v_ingestion_summary"
    | "v_match_review_queue"
    | "source_leads"
    | "fub_leads"
    | "lead_matches";

  /** Filters to apply */
  filters?: WidgetFilter[];

  /** Fields to group by */
  groupBy?: string[];

  /** Aggregations to perform */
  aggregations?: {
    field: string;
    type: AggregationType;
    alias?: string;
  }[];

  /** Order by */
  orderBy?: {
    field: string;
    direction: "asc" | "desc";
  };

  /** Limit results */
  limit?: number;

  /** Date range filter (convenience) */
  dateRange?: {
    field: string;
    start?: string;
    end?: string;
    preset?: "today" | "yesterday" | "7d" | "30d" | "90d" | "ytd" | "all";
  };
}

export interface WidgetVisualization {
  /** X-axis field (for charts) */
  xAxis?: string;

  /** Y-axis field (for charts) */
  yAxis?: string;

  /** Series field for stacked/grouped charts */
  series?: string;

  /** Color scheme */
  colors?: string[];

  /** Show legend */
  showLegend?: boolean;

  /** Show grid lines */
  showGrid?: boolean;

  /** Value formatting */
  valueFormat?: "number" | "percent" | "currency" | "compact";

  /** For metric widgets */
  metric?: {
    value: string;
    label?: string;
    trend?: {
      field: string;
      comparison: "previous_period" | "previous_year";
    };
  };

  /** For table widgets */
  table?: {
    columns: {
      field: string;
      header: string;
      width?: string;
      align?: "left" | "center" | "right";
      format?: "text" | "number" | "date" | "badge";
    }[];
    pageSize?: number;
  };
}

export interface WidgetConfig {
  /** Unique identifier */
  id: string;

  /** Widget type */
  type: WidgetType;

  /** Display title */
  title: string;

  /** Optional description */
  description?: string;

  /** Data query configuration */
  query: WidgetQuery;

  /** Visualization configuration */
  visualization: WidgetVisualization;

  /** Widget size */
  size: WidgetSize;

  /** Auto-refresh interval in seconds (0 = no refresh) */
  refreshInterval?: number;

  /** Position in dashboard grid */
  position?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface WidgetData {
  /** Raw data from query */
  rows: Record<string, unknown>[];

  /** Metadata */
  meta: {
    total: number;
    queryTime: number;
    cached: boolean;
  };
}

export interface WidgetState {
  config: WidgetConfig;
  data?: WidgetData;
  isLoading: boolean;
  error?: string;
  lastUpdated?: Date;
}

/** Dashboard containing multiple widgets */
export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: WidgetConfig[];
  layout?: "grid" | "free";
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}
