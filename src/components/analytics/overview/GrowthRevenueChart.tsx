"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrencyFromCents } from "@/utils/formatCurrency";
import type { TrendDataPoint } from "../types";
import {
  AnalyticsEmptyState,
  AnalyticsNoResults,
} from "../AnalyticsEmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { parseCalendarDate } from "@/lib/dateUtils";

const chartConfig = {
  users: { label: "New users", color: "var(--chart-users)" },
  previousUsers: { label: "Previous", color: "var(--muted-foreground)" },
  revenue: { label: "Revenue", color: "var(--chart-2)" },
} satisfies ChartConfig;

const numberFormatter = new Intl.NumberFormat("de-DE");

function formatAxisNumber(value: number | string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
  if (abs >= 10_000) return `${Math.round(n / 1000)}K`;
  if (abs >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return numberFormatter.format(Math.round(n));
}

export type GrowthChartPoint = TrendDataPoint & { revenue?: number };

function pct(cur: number, prev: number): number {
  if (!prev) return 0;
  return Math.round(((cur - prev) / Math.abs(prev)) * 100);
}

function ToggleStat({
  active,
  accent,
  label,
  value,
  delta,
  onClick,
}: {
  active: boolean;
  accent: "users" | "revenue";
  label: string;
  value: string;
  delta: number;
  onClick: () => void;
}) {
  const Trend = delta < 0 ? TrendingDown : TrendingUp;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-[158px] flex-col gap-1 rounded-[10px] border bg-background px-3 py-2 text-left transition-colors",
        active &&
          accent === "users" &&
          "border-[var(--chart-users)]/40 bg-[var(--chart-users)]/[0.05]",
        active &&
          accent === "revenue" &&
          "border-[var(--chart-2)]/40 bg-[var(--chart-2)]/[0.05]",
        !active && "border-sidebar-border opacity-55"
      )}
    >
      <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <span
          className={cn(
            "size-2 rounded-full",
            accent === "users"
              ? "bg-[var(--chart-users)]"
              : "bg-[var(--chart-2)]"
          )}
        />
        {label}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold tabular-nums tracking-tight">
          {value}
        </span>
        {delta !== 0 && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums",
              delta > 0
                ? "bg-valid-green-light-2 text-valid-green dark:bg-valid-green/15 dark:text-emerald-400"
                : "bg-destructive-secondary text-destructive dark:bg-destructive/15 dark:text-red-400"
            )}
          >
            <Trend className="size-3" />
            {Math.abs(delta)}%
          </span>
        )}
      </span>
    </button>
  );
}

interface Props {
  data?: GrowthChartPoint[];
  usersTotal: number;
  usersPrev: number;
  revenueTotal: number;
  revenuePrev: number;
  revenueEnabled: boolean;
  hasFilters?: boolean;
  loading?: boolean;
  chartLoading?: boolean;
}

export function GrowthRevenueChart({
  data,
  usersTotal,
  usersPrev,
  revenueTotal,
  revenuePrev,
  revenueEnabled,
  hasFilters = false,
  loading = false,
  chartLoading = false,
}: Props) {
  const [showUsers, setShowUsers] = useState(true);
  const [showRevenue, setShowRevenue] = useState(false);

  const hasRevenueSeries = !!data?.some((d) => typeof d.revenue === "number");

  return (
    <div className="rounded-xl border border-sidebar-border bg-background overflow-hidden">
      <div className="p-5">
        <div className="mb-3 flex flex-wrap gap-2.5">
          {loading ? (
            <>
              <Skeleton className="h-[66px] w-[158px] rounded-[10px]" />
              {revenueEnabled && (
                <Skeleton className="h-[66px] w-[158px] rounded-[10px]" />
              )}
            </>
          ) : (
            <>
              <ToggleStat
                active={showUsers}
                accent="users"
                label="New users"
                value={numberFormatter.format(usersTotal)}
                delta={pct(usersTotal, usersPrev)}
                onClick={() => setShowUsers((v) => (showRevenue ? !v : true))}
              />
              {revenueEnabled && (
                <ToggleStat
                  active={showRevenue}
                  accent="revenue"
                  label="Revenue"
                  value={formatCurrencyFromCents(revenueTotal)}
                  delta={pct(revenueTotal, revenuePrev)}
                  onClick={() => setShowRevenue((v) => (showUsers ? !v : true))}
                />
              )}
            </>
          )}
        </div>

        {chartLoading ? (
          <div className="flex h-[250px] w-full flex-col justify-end gap-3 py-4">
            <div className="flex flex-1 items-end gap-2">
              {Array.from({ length: 18 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="flex-1 rounded-t-md"
                  style={{ height: `${28 + ((i * 17) % 58)}%` }}
                />
              ))}
            </div>
            <Skeleton className="h-3 w-full" />
          </div>
        ) : !data || data.length === 0 ? (
          hasFilters ? (
            <AnalyticsNoResults />
          ) : (
            <AnalyticsEmptyState
              icon={TrendingUp}
              title="No trend data yet"
              description="Track how your user base and revenue grow over time. Integrate the Grovs SDK and trends will appear here."
              sdkDescription="No trend data recorded yet."
              linkHref="/developers"
              linkLabel="Set up the SDK"
            />
          )
        ) : (
          <>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <ComposedChart
                data={data}
                margin={{ top: 10, right: 12, left: 6, bottom: 0 }}
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
                  tickFormatter={(value) =>
                    parseCalendarDate(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="users"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  width={54}
                  allowDecimals={false}
                  tickFormatter={formatAxisNumber}
                />
                <YAxis
                  yAxisId="revenue"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) =>
                    `$${value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value}`
                  }
                  hide={!showRevenue || !hasRevenueSeries}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      valueFormatter={numberFormatter.format}
                    />
                  }
                />
                {showUsers && (
                  <>
                    <Area
                      yAxisId="users"
                      type="monotone"
                      dataKey="previousUsers"
                      stroke="var(--color-previousUsers)"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      fill="none"
                    />
                    <Area
                      yAxisId="users"
                      type="monotone"
                      dataKey="users"
                      stroke="var(--color-users)"
                      strokeWidth={2}
                      fill="url(#fillUsers)"
                    />
                  </>
                )}
                {showRevenue && hasRevenueSeries && (
                  <Line
                    yAxisId="revenue"
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-revenue)"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
              </ComposedChart>
            </ChartContainer>
            {showRevenue && !hasRevenueSeries && (
              <p className="mt-2 text-[11px] text-muted-foreground/70">
                Revenue total is live; the trend line appears once
                <span className="font-mono"> /overview/trends/users </span>
                returns a per-day{" "}
                <span className="font-mono">revenue_usd_cents</span> field.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
