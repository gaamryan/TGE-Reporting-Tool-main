"use client";

import { WidgetRenderer } from "./widget-renderer";
import { useWidgetData } from "@/hooks/use-widget-data";
import { WidgetConfig, WidgetData } from "@/types/widget";

interface WidgetWithDataProps {
  config: WidgetConfig;
  /** Optional fallback data to show when real data is empty */
  fallbackData?: WidgetData;
  /** Show sample data if no real data exists */
  showSampleOnEmpty?: boolean;
  isDragging?: boolean;
  onRemove?: () => void;
  onExpand?: () => void;
  className?: string;
}

/** Sample data to show when database is empty */
const SAMPLE_DATA: WidgetData = {
  rows: [
    { name: "Sample A", value: 45, source: "Sample", count: 45, total_leads: 45 },
    { name: "Sample B", value: 62, source: "Demo", count: 62, total_leads: 62 },
    { name: "Sample C", value: 51, source: "Test", count: 51, total_leads: 51 },
    { name: "Sample D", value: 38, source: "Example", count: 38, total_leads: 38 },
  ],
  meta: { total: 4, queryTime: 0, cached: false },
};

/**
 * Widget component that automatically fetches its own data from Supabase
 */
export function WidgetWithData({
  config,
  fallbackData,
  showSampleOnEmpty = true,
  isDragging,
  onRemove,
  onExpand,
  className,
}: WidgetWithDataProps) {
  const { data, isLoading, error } = useWidgetData(config.query, {
    autoFetch: true,
    refreshInterval: config.refreshInterval ? config.refreshInterval * 1000 : 0,
  });

  // Determine what data to display
  let displayData = data;
  let displayError: string | undefined = error ?? undefined;

  // If data is empty (no rows), show fallback or sample data
  if (!isLoading && !error && data && data.rows.length === 0) {
    if (fallbackData) {
      displayData = fallbackData;
    } else if (showSampleOnEmpty) {
      displayData = SAMPLE_DATA;
      // Clear any error when showing sample data
      displayError = undefined;
    }
  }

  return (
    <WidgetRenderer
      config={config}
      data={displayData ?? undefined}
      isLoading={isLoading}
      error={displayError ?? undefined}
      isDragging={isDragging}
      onRemove={onRemove}
      onExpand={onExpand}
      className={className}
    />
  );
}

/**
 * Hook to manage multiple widget data states
 */
export function useMultipleWidgetData(widgets: WidgetConfig[]) {
  // This hook manages data for multiple widgets
  // Each widget fetches its own data independently via useWidgetData
  // This is a lightweight wrapper for batch operations

  const refetchAll = async () => {
    // Individual widgets handle their own refetching via useWidgetData
    // This function can be used for manual refresh triggers
  };

  return { refetchAll };
}
