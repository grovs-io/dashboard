"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { EventVolumeBin } from "./types";

const chartConfig = {
  count: {
    label: "Events",
    color: "var(--chart-users)",
  },
} satisfies ChartConfig;

interface EventVolumeChartProps {
  data: EventVolumeBin[];
  hasFilters?: boolean;
  loading?: boolean;
  /** Error message to show in place of the chart (e.g. query_too_heavy). */
  error?: string | null;
  /** Caption shown under the chart, e.g. the 90-day aggregate cap notice. */
  notice?: string | null;
}

export default function EventVolumeChart({
  data,
  hasFilters = false,
  loading = false,
  error = null,
  notice = null,
}: EventVolumeChartProps) {
  const hasData = data.length > 0;

  if (error) {
    return (
      <div className="flex items-center justify-center h-[120px] rounded-md border border-dashed border-destructive/30 bg-destructive/5 px-4">
        <p className="text-xs text-destructive text-center">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {loading ? (
        <div className="flex h-[120px] w-full items-end gap-1.5 rounded-md border border-sidebar-border/70 px-3 py-3">
          {Array.from({ length: 32 }).map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t-sm"
              style={{ height: `${18 + ((i * 23) % 72)}%` }}
            />
          ))}
        </div>
      ) : hasData ? (
        <ChartContainer config={chartConfig} className="h-[120px] w-full">
          <BarChart
            data={data}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="fillEvents" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--chart-users)"
                  stopOpacity={0.85}
                />
                <stop
                  offset="95%"
                  stopColor="var(--chart-users)"
                  stopOpacity={0.35}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              className="stroke-sidebar-border"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              width={40}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
              }
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="count"
              fill="url(#fillEvents)"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      ) : (
        <div className="flex items-center justify-center h-[120px] rounded-md border border-dashed border-sidebar-border">
          <p className="text-xs text-muted-foreground">
            {hasFilters
              ? "No events match the current filters"
              : "Volume histogram will appear once events are recorded"}
          </p>
        </div>
      )}
      {notice && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">{notice}</p>
      )}
    </div>
  );
}
