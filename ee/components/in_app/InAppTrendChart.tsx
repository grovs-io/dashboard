"use client";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { InAppReport } from "@ee/types/inApp";

const chartConfig = {
  views: { label: "Views", color: "var(--chart-users)" },
  clicks: { label: "Clicks", color: "var(--chart-2)" },
  dismissals: { label: "Dismissals", color: "var(--chart-3)" },
} satisfies ChartConfig;

// "2026-09-20" becomes 09/20; an hourly bucket keeps its hour, which is a UTC hour and says so.
export const bucketLabel = (bucket: string) =>
  bucket.length > 10
    ? `${bucket.slice(5, 10).replace("-", "/")} ${bucket.slice(11, 16)} UTC`
    : bucket.slice(5).replace("-", "/");

const SERIES = ["views", "clicks", "dismissals"] as const;

export default function InAppTrendChart({
  trend,
  clicks = true,
}: {
  trend: InAppReport["trend"];
  // A message that asks a question has nothing to click.
  clicks?: boolean;
}) {
  if (trend.length === 0)
    return (
      <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-sidebar-border text-sm text-muted-foreground">
        Nothing was shown in this period.
      </div>
    );
  const data = trend.map((point) => ({
    ...point,
    label: bucketLabel(point.bucket),
  }));
  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <LineChart
        data={data}
        margin={{ top: 10, right: 12, left: 6, bottom: 0 }}
      >
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
          allowDecimals={false}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {SERIES.filter((key) => clicks || key !== "clicks").map((key) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={`var(--color-${key})`}
            strokeWidth={2}
            dot={data.length < 3}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
