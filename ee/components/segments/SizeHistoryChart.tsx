"use client";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { SegmentSizePoint } from "@ee/types/segments";

const chartConfig = {
  persons: { label: "People", color: "var(--chart-users)" },
  devices: { label: "Devices", color: "var(--chart-2)" },
} satisfies ChartConfig;

const compact = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1000
      ? `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}K`
      : String(v);

export default function SizeHistoryChart({
  points,
  pending,
}: {
  points: SegmentSizePoint[] | undefined;
  pending: boolean;
}) {
  if (pending) return <Skeleton className="h-[220px] w-full" />;
  const data = [...(points ?? [])]
    .reverse()
    .map((p) => ({ ...p, label: p.date.slice(5).replace("-", "/") }));
  if (data.length < 2)
    return (
      <div className="flex h-[220px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-sidebar-border text-center text-sm text-muted-foreground">
        <span>Not enough history yet.</span>
        <span className="text-xs">Segment size is recorded once a day.</span>
      </div>
    );
  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <ComposedChart
        data={data}
        margin={{ top: 10, right: 12, left: 6, bottom: 0 }}
      >
        <defs>
          <linearGradient id="fillSegmentPersons" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-persons)"
              stopOpacity={0.25}
            />
            <stop
              offset="95%"
              stopColor="var(--color-persons)"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
          minTickGap={32}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          width={44}
          tickFormatter={compact}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="persons"
          stroke="var(--color-persons)"
          strokeWidth={2}
          fill="url(#fillSegmentPersons)"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="devices"
          stroke="var(--color-devices)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
