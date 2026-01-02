"use client";

import { useMemo } from "react";
import {
  BarChart,
  LineChart,
  AreaChart,
  DonutChart,
  SparkAreaChart,
} from "@/components/ui/chart";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WidgetConfig, WidgetData } from "@/types/widget";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import { Loader2, GripVertical, X, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WidgetRendererProps {
  config: WidgetConfig;
  data?: WidgetData;
  isLoading?: boolean;
  error?: string;
  isDragging?: boolean;
  onRemove?: () => void;
  onExpand?: () => void;
  className?: string;
}

const sizeClasses: Record<string, string> = {
  sm: "col-span-1 row-span-1",
  md: "col-span-2 row-span-1",
  lg: "col-span-2 row-span-2",
  xl: "col-span-3 row-span-2",
  full: "col-span-full row-span-2",
};

export function WidgetRenderer({
  config,
  data,
  isLoading,
  error,
  isDragging,
  onRemove,
  onExpand,
  className,
}: WidgetRendererProps) {
  const chartData = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows as Record<string, unknown>[];
  }, [data]);

  const { visualization } = config;

  return (
    <Card
      className={cn(
        "relative group transition-all duration-200",
        sizeClasses[config.size],
        isDragging && "ring-2 ring-primary shadow-xl",
        className
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardTitle className="truncate text-base">{config.title}</CardTitle>
            </div>
            {config.description && (
              <CardDescription className="truncate mt-1">{config.description}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onExpand && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onExpand}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
            {onRemove && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-48 text-destructive">
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <WidgetContent
            type={config.type}
            data={chartData}
            visualization={visualization}
          />
        )}
      </CardContent>
    </Card>
  );
}

interface WidgetContentProps {
  type: WidgetConfig["type"];
  data: Record<string, unknown>[];
  visualization: WidgetConfig["visualization"];
}

function WidgetContent({ type, data, visualization }: WidgetContentProps) {
  const { xAxis, yAxis, series, colors, showLegend, valueFormat } = visualization;

  const formatValue = (value: number) => {
    switch (valueFormat) {
      case "percent":
        return formatPercent(value);
      case "currency":
        return `$${formatNumber(value)}`;
      case "compact":
        return Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
      default:
        return formatNumber(value);
    }
  };

  switch (type) {
    case "bar":
      return (
        <BarChart
          data={data}
          index={xAxis || "name"}
          categories={series ? [series] : [yAxis || "value"]}
          colors={colors as ("blue" | "green" | "red" | "yellow" | "purple")[]}
          valueFormatter={formatValue}
          showLegend={showLegend}
          className="h-48"
        />
      );

    case "line":
      return (
        <LineChart
          data={data}
          index={xAxis || "name"}
          categories={series ? [series] : [yAxis || "value"]}
          colors={colors as ("blue" | "green" | "red" | "yellow" | "purple")[]}
          valueFormatter={formatValue}
          showLegend={showLegend}
          className="h-48"
        />
      );

    case "area":
      return (
        <AreaChart
          data={data}
          index={xAxis || "name"}
          categories={series ? [series] : [yAxis || "value"]}
          colors={colors as ("blue" | "green" | "red" | "yellow" | "purple")[]}
          valueFormatter={formatValue}
          showLegend={showLegend}
          className="h-48"
        />
      );

    case "donut":
      return (
        <DonutChart
          data={data}
          index={xAxis || "name"}
          category={yAxis || "value"}
          colors={colors as ("blue" | "green" | "red" | "yellow" | "purple")[]}
          valueFormatter={formatValue}
          className="h-48"
        />
      );

    case "sparkline":
      return (
        <SparkAreaChart
          data={data}
          index={xAxis || "name"}
          categories={[yAxis || "value"]}
          colors={["blue"]}
          className="h-12 w-full"
        />
      );

    case "metric":
      const metricConfig = visualization.metric;
      const metricValue = data[0]?.[metricConfig?.value || "value"] as number;
      return (
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold tracking-tight">
            {formatValue(metricValue || 0)}
          </span>
          {metricConfig?.trend && (
            <Badge variant="secondary" className="text-green-600">
              +12.3%
            </Badge>
          )}
        </div>
      );

    case "table":
      const tableConfig = visualization.table;
      const columns = tableConfig?.columns || [
        { field: "name", header: "Name" },
        { field: "value", header: "Value" },
      ];
      return (
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.field} className={col.align ? `text-${col.align}` : undefined}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.slice(0, tableConfig?.pageSize || 10).map((row, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col.field} className={col.align ? `text-${col.align}` : undefined}>
                    {String(row[col.field] ?? "-")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );

    case "list":
      return (
        <div className="space-y-2">
          {data.slice(0, 5).map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-sm text-muted-foreground">{String(item[xAxis || "name"])}</span>
              <span className="text-sm font-medium">{formatValue(item[yAxis || "value"] as number)}</span>
            </div>
          ))}
        </div>
      );

    default:
      return <p className="text-sm text-muted-foreground">Unsupported widget type: {type}</p>;
  }
}
