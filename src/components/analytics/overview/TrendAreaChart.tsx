"use client";

import {
  Area,
  Line,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { parseCalendarDate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import type { AnalyticsGranularity } from "@/types";
import { numberFormatter, formatAxisNumber } from "./metricFormat";

export type TrendDatum = { date: string; value: number; previous?: number };

const chartConfig = {
  value: { label: "Current", color: "var(--chart-users)" },
  previous: { label: "Previous", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

// Static classes so Tailwind emits them; other heights fall back to an inline style.
const HEIGHT_CLASS: Record<number, string> = {
  200: "h-[200px]",
  250: "h-[250px]",
};

const moneyAxis = (value: number | string) => {
  const n = Number(value);
  return `$${n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n}`;
};

interface Props {
  data: TrendDatum[];
  granularity: AnalyticsGranularity;
  /** Dollar axis and tooltip instead of counts. */
  money?: boolean;
  height?: number;
}

/** The Overview's trend chart: current area plus a dashed previous-period line when present. */
export function TrendAreaChart({
  data,
  granularity,
  money = false,
  height = 250,
}: Props) {
  const hasPrevious = data.some((d) => typeof d.previous === "number");
  return (
    <ChartContainer
      config={chartConfig}
      className={cn(HEIGHT_CLASS[height], "w-full")}
      style={HEIGHT_CLASS[height] ? undefined : { height }}
    >
      <ComposedChart
        data={data}
        margin={{ top: 10, right: 12, left: 6, bottom: 0 }}
      >
        <defs>
          <linearGradient id="fillKeyMetric" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-value)"
              stopOpacity={0.25}
            />
            <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) =>
            parseCalendarDate(value).toLocaleDateString(
              "en-US",
              granularity === "month"
                ? { month: "short", year: "2-digit" }
                : { month: "short", day: "numeric" }
            )
          }
          interval="preserveStartEnd"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          width={54}
          allowDecimals={false}
          tickFormatter={money ? moneyAxis : formatAxisNumber}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              valueFormatter={
                money ? (v: number) => moneyAxis(v) : numberFormatter.format
              }
            />
          }
        />
        {hasPrevious && (
          <Line
            type="monotone"
            dataKey="previous"
            stroke="var(--color-previous)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
          />
        )}
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--color-value)"
          strokeWidth={2}
          fill="url(#fillKeyMetric)"
        />
      </ComposedChart>
    </ChartContainer>
  );
}
