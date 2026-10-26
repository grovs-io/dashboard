"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  formatAxisNumber,
  numberFormatter,
} from "@/components/analytics/overview/metricFormat";
import { bucketLabel, OTHER_KEY } from "@/lib/metricQuery";
import { parseCalendarDate } from "@/lib/dateUtils";
import type { AnalyticsGranularity, MetricQueryRow } from "@/types";
import type { WidgetData } from "./types";

// Backend limit for line widgets, so its Other is a true distinct count.
export const LINE_SERIES = 5;
const COLORS = [
  "var(--chart-users)",
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--muted-foreground)",
];

export function lineSeries(data: WidgetData): MetricQueryRow[] {
  // Capped too while a bar/table widget's previous data is still on screen.
  const rows = data.rows.slice(0, LINE_SERIES);
  return data.other?.points ? [...rows, data.other] : rows;
}

export function LineWidget({
  data,
  granularity,
  compact = false,
}: {
  data: WidgetData;
  granularity: AnalyticsGranularity;
  compact?: boolean;
}) {
  const series = useMemo(() => lineSeries(data), [data]);

  const { config, points } = useMemo(() => {
    const config: ChartConfig = {};
    series.forEach((s, i) => {
      config[`s${i}`] = {
        label: s.key === OTHER_KEY ? "Other" : bucketLabel(data.group_by, s),
        color: COLORS[i % COLORS.length],
      };
    });
    const dates = series[0]?.points?.map((p) => p.date) ?? [];
    const points = dates.map((date, idx) => {
      const row: Record<string, number | string> = { date };
      series.forEach((s, i) => {
        row[`s${i}`] = s.points?.[idx]?.value ?? 0;
      });
      return row;
    });
    return { config, points };
  }, [series, data.group_by]);

  if (points.length === 0) return null;

  return (
    <ChartContainer
      config={config}
      className={compact ? "h-[170px] w-full" : "h-[220px] w-full"}
    >
      <LineChart
        data={points}
        margin={{ top: 10, right: 12, left: 6, bottom: 0 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval="preserveStartEnd"
          tickFormatter={(v) =>
            parseCalendarDate(v).toLocaleDateString(
              "en-US",
              granularity === "month"
                ? { month: "short", year: "2-digit" }
                : { month: "short", day: "numeric" }
            )
          }
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          width={54}
          allowDecimals={false}
          tickFormatter={formatAxisNumber}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent valueFormatter={numberFormatter.format} />
          }
        />
        {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {series.map((_, i) => (
          <Line
            key={`s${i}`}
            type="monotone"
            dataKey={`s${i}`}
            stroke={`var(--color-s${i})`}
            strokeWidth={i === 0 ? 2 : 1.5}
            dot={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
