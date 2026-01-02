"use client";

import * as React from "react";
import {
  BarChart as RechartsBarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  AreaChart as RechartsAreaChart,
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

const COLORS = {
  blue: "hsl(221, 83%, 53%)",
  green: "hsl(142, 71%, 45%)",
  red: "hsl(0, 84%, 60%)",
  yellow: "hsl(45, 93%, 47%)",
  purple: "hsl(262, 83%, 58%)",
  gray: "hsl(220, 9%, 46%)",
};

const COLOR_ARRAY = [
  COLORS.blue,
  COLORS.green,
  COLORS.yellow,
  COLORS.purple,
  COLORS.red,
  COLORS.gray,
];

interface BaseChartProps {
  data: Record<string, unknown>[];
  index: string;
  categories?: string[];
  colors?: (keyof typeof COLORS)[];
  valueFormatter?: (value: number) => string;
  showLegend?: boolean;
  className?: string;
}

export function BarChart({
  data,
  index,
  categories = ["value"],
  colors = ["blue"],
  valueFormatter = (v) => String(v),
  showLegend = true,
  className,
}: BaseChartProps) {
  return (
    <div className={cn("w-full h-48", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey={index}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={valueFormatter}
            className="text-muted-foreground"
          />
          <Tooltip
            formatter={(value: number) => valueFormatter(value)}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
            }}
          />
          {showLegend && <Legend />}
          {categories.map((category, i) => (
            <Bar
              key={category}
              dataKey={category}
              fill={COLORS[colors[i % colors.length] as keyof typeof COLORS] || COLOR_ARRAY[i % COLOR_ARRAY.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineChart({
  data,
  index,
  categories = ["value"],
  colors = ["blue"],
  valueFormatter = (v) => String(v),
  showLegend = true,
  className,
}: BaseChartProps) {
  return (
    <div className={cn("w-full h-48", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey={index}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={valueFormatter}
            className="text-muted-foreground"
          />
          <Tooltip
            formatter={(value: number) => valueFormatter(value)}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
            }}
          />
          {showLegend && <Legend />}
          {categories.map((category, i) => (
            <Line
              key={category}
              type="monotone"
              dataKey={category}
              stroke={COLORS[colors[i % colors.length] as keyof typeof COLORS] || COLOR_ARRAY[i % COLOR_ARRAY.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AreaChart({
  data,
  index,
  categories = ["value"],
  colors = ["blue"],
  valueFormatter = (v) => String(v),
  showLegend = true,
  className,
}: BaseChartProps) {
  return (
    <div className={cn("w-full h-48", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey={index}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={valueFormatter}
            className="text-muted-foreground"
          />
          <Tooltip
            formatter={(value: number) => valueFormatter(value)}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
            }}
          />
          {showLegend && <Legend />}
          {categories.map((category, i) => {
            const color = COLORS[colors[i % colors.length] as keyof typeof COLORS] || COLOR_ARRAY[i % COLOR_ARRAY.length];
            return (
              <Area
                key={category}
                type="monotone"
                dataKey={category}
                stroke={color}
                fill={color}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            );
          })}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface DonutChartProps {
  data: Record<string, unknown>[];
  index: string;
  category: string;
  colors?: (keyof typeof COLORS)[];
  valueFormatter?: (value: number) => string;
  showLabel?: boolean;
  className?: string;
}

export function DonutChart({
  data,
  index,
  category,
  colors = ["blue", "green", "yellow", "purple", "red"],
  valueFormatter = (v) => String(v),
  className,
}: DonutChartProps) {
  return (
    <div className={cn("w-full h-48", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            dataKey={category}
            nameKey={index}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell
                key={`cell-${i}`}
                fill={COLORS[colors[i % colors.length] as keyof typeof COLORS] || COLOR_ARRAY[i % COLOR_ARRAY.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => valueFormatter(value)}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
            }}
          />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface SparkAreaChartProps {
  data: Record<string, unknown>[];
  index: string;
  categories: string[];
  colors?: (keyof typeof COLORS)[];
  className?: string;
}

export function SparkAreaChart({
  data,
  index,
  categories,
  colors = ["blue"],
  className,
}: SparkAreaChartProps) {
  return (
    <div className={cn("w-full h-12", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          {categories.map((category, i) => {
            const color = COLORS[colors[i % colors.length] as keyof typeof COLORS] || COLOR_ARRAY[i % COLOR_ARRAY.length];
            return (
              <Area
                key={category}
                type="monotone"
                dataKey={category}
                stroke={color}
                fill={color}
                fillOpacity={0.2}
                strokeWidth={1.5}
              />
            );
          })}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
