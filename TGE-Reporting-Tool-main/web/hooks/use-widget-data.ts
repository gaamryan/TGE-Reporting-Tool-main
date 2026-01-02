"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { WidgetQuery, WidgetData, WidgetFilter } from "@/types/widget";

interface UseWidgetDataOptions {
  /** Auto-fetch on mount */
  autoFetch?: boolean;
  /** Refresh interval in milliseconds (0 = no refresh) */
  refreshInterval?: number;
}

interface UseWidgetDataReturn {
  data: WidgetData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Calculate date range based on preset
 */
function getDateRange(preset: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let start: Date;

  switch (preset) {
    case "today":
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      break;
    case "yesterday":
      start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      break;
    case "7d":
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case "30d":
      start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      break;
    case "90d":
      start = new Date(now);
      start.setDate(start.getDate() - 90);
      start.setHours(0, 0, 0, 0);
      break;
    case "ytd":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case "all":
    default:
      start = new Date(0);
      break;
  }

  return { start, end };
}

/**
 * Apply filter to Supabase query builder
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilter(query: any, filter: WidgetFilter) {
  const { field, operator, value } = filter;

  switch (operator) {
    case "eq":
      return query.eq(field, value);
    case "neq":
      return query.neq(field, value);
    case "gt":
      return query.gt(field, value);
    case "gte":
      return query.gte(field, value);
    case "lt":
      return query.lt(field, value);
    case "lte":
      return query.lte(field, value);
    case "in":
      return query.in(field, value as string[]);
    case "like":
      return query.like(field, value as string);
    case "ilike":
      return query.ilike(field, value as string);
    default:
      return query;
  }
}

/**
 * Hook to fetch widget data from Supabase based on WidgetQuery config
 */
export function useWidgetData(
  widgetQuery: WidgetQuery | null,
  options: UseWidgetDataOptions = {}
): UseWidgetDataReturn {
  const { autoFetch = true, refreshInterval = 0 } = options;
  const [data, setData] = useState<WidgetData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!widgetQuery) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const startTime = performance.now();
    const supabase = createClient();

    try {
      // Start building the query
      let query = supabase.from(widgetQuery.source).select("*");

      // Apply filters
      if (widgetQuery.filters) {
        for (const filter of widgetQuery.filters) {
          query = applyFilter(query, filter) as typeof query;
        }
      }

      // Apply date range filter
      if (widgetQuery.dateRange) {
        const { field, start, end, preset } = widgetQuery.dateRange;

        if (preset) {
          const range = getDateRange(preset);
          query = query
            .gte(field, range.start.toISOString())
            .lte(field, range.end.toISOString());
        } else {
          if (start) {
            query = query.gte(field, start);
          }
          if (end) {
            query = query.lte(field, end);
          }
        }
      }

      // Apply ordering
      if (widgetQuery.orderBy) {
        query = query.order(widgetQuery.orderBy.field, {
          ascending: widgetQuery.orderBy.direction === "asc",
        });
      }

      // Apply limit
      if (widgetQuery.limit) {
        query = query.limit(widgetQuery.limit);
      }

      const { data: rows, error: queryError } = await query;

      if (queryError) {
        throw new Error(queryError.message);
      }

      const queryTime = Math.round(performance.now() - startTime);

      // If groupBy is specified, we need to aggregate the data client-side
      // (Supabase views should already have aggregated data, but this handles raw tables)
      let processedRows = rows || [];

      if (widgetQuery.groupBy && widgetQuery.groupBy.length > 0 && processedRows.length > 0) {
        processedRows = aggregateData(processedRows, widgetQuery.groupBy, widgetQuery.aggregations);
      }

      setData({
        rows: processedRows,
        meta: {
          total: processedRows.length,
          queryTime,
          cached: false,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch data";
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [widgetQuery]);

  // Auto-fetch on mount and when query changes
  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [autoFetch, fetchData]);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

/**
 * Aggregate data client-side based on groupBy fields
 */
function aggregateData(
  rows: Record<string, unknown>[],
  groupBy: string[],
  aggregations?: WidgetQuery["aggregations"]
): Record<string, unknown>[] {
  const groups = new Map<string, Record<string, unknown>[]>();

  // Group rows
  for (const row of rows) {
    const key = groupBy.map((field) => String(row[field] ?? "")).join("||");
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row);
  }

  // Aggregate each group
  const result: Record<string, unknown>[] = [];

  for (const [, groupRows] of groups) {
    const aggregatedRow: Record<string, unknown> = {};

    // Copy groupBy fields from first row
    for (const field of groupBy) {
      aggregatedRow[field] = groupRows[0][field];
    }

    // Apply aggregations or default to count
    if (aggregations && aggregations.length > 0) {
      for (const agg of aggregations) {
        const values = groupRows
          .map((r) => r[agg.field])
          .filter((v) => typeof v === "number") as number[];
        const alias = agg.alias || `${agg.type}_${agg.field}`;

        switch (agg.type) {
          case "count":
            aggregatedRow[alias] = groupRows.length;
            break;
          case "sum":
            aggregatedRow[alias] = values.reduce((a, b) => a + b, 0);
            break;
          case "avg":
            aggregatedRow[alias] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            break;
          case "min":
            aggregatedRow[alias] = values.length > 0 ? Math.min(...values) : 0;
            break;
          case "max":
            aggregatedRow[alias] = values.length > 0 ? Math.max(...values) : 0;
            break;
        }
      }
    } else {
      // Default: count
      aggregatedRow["count"] = groupRows.length;
      aggregatedRow["value"] = groupRows.length;
    }

    result.push(aggregatedRow);
  }

  return result;
}

/**
 * Fetch widget data directly (for use outside React components)
 */
export async function fetchWidgetData(
  widgetQuery: WidgetQuery
): Promise<WidgetData> {
  const startTime = performance.now();
  const supabase = createClient();

  let query = supabase.from(widgetQuery.source).select("*");

  // Apply filters
  if (widgetQuery.filters) {
    for (const filter of widgetQuery.filters) {
      query = applyFilter(query, filter) as typeof query;
    }
  }

  // Apply date range filter
  if (widgetQuery.dateRange) {
    const { field, start, end, preset } = widgetQuery.dateRange;

    if (preset) {
      const range = getDateRange(preset);
      query = query
        .gte(field, range.start.toISOString())
        .lte(field, range.end.toISOString());
    } else {
      if (start) {
        query = query.gte(field, start);
      }
      if (end) {
        query = query.lte(field, end);
      }
    }
  }

  // Apply ordering
  if (widgetQuery.orderBy) {
    query = query.order(widgetQuery.orderBy.field, {
      ascending: widgetQuery.orderBy.direction === "asc",
    });
  }

  // Apply limit
  if (widgetQuery.limit) {
    query = query.limit(widgetQuery.limit);
  }

  const { data: rows, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const queryTime = Math.round(performance.now() - startTime);

  let processedRows = rows || [];

  if (widgetQuery.groupBy && widgetQuery.groupBy.length > 0 && processedRows.length > 0) {
    processedRows = aggregateData(processedRows, widgetQuery.groupBy, widgetQuery.aggregations);
  }

  return {
    rows: processedRows,
    meta: {
      total: processedRows.length,
      queryTime,
      cached: false,
    },
  };
}
