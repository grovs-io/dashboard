"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { TrendingUp } from "lucide-react";
import type { TrendDataPoint } from "../types";
import {
  AnalyticsEmptyState,
  AnalyticsNoResults,
} from "../AnalyticsEmptyState";
import { parseCalendarDate } from "@/lib/dateUtils";

const chartConfig = {
  users: {
    label: "Users",
    color: "var(--chart-users)",
  },
  previousUsers: {
    label: "Previous Period",
    color: "var(--muted-foreground)",
  },
} satisfies ChartConfig;

interface TrendsAreaChartProps {
  data?: TrendDataPoint[];
  hasFilters?: boolean;
}

export function TrendsAreaChart({
  data,
  hasFilters = false,
}: TrendsAreaChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-sidebar-border bg-background shadow-none overflow-hidden">
        <div className="px-5 py-3 bg-muted/40 border-b border-sidebar-border">
          <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Users Over Time
          </h3>
        </div>
        {hasFilters ? (
          <AnalyticsNoResults />
        ) : (
          <AnalyticsEmptyState
            icon={TrendingUp}
            title="No trend data yet"
            description="Track how your user base grows over time. Integrate the Grovs SDK and trends will appear as users interact with your app."
            sdkDescription="No trend data recorded yet. Trends will appear as users interact with your app."
            linkHref="/developers"
            linkLabel="Set up the SDK"
          />
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-sidebar-border bg-background shadow-none overflow-hidden">
      <div className="px-5 py-3 bg-muted/40 border-b border-sidebar-border">
        <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Users Over Time
        </h3>
      </div>
      <div className="p-5">
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="fillUsers" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-users)"
                  stopOpacity={0.25}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-users)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => {
                const d = parseCalendarDate(value);
                return d.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) =>
                value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value
              }
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="previousUsers"
              stroke="var(--color-previousUsers)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              fill="none"
            />
            <Area
              type="monotone"
              dataKey="users"
              stroke="var(--color-users)"
              strokeWidth={2}
              fill="url(#fillUsers)"
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  );
}
