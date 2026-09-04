"use client";

import { useMemo, useState } from "react";
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
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyFromCents } from "@/utils/formatCurrency";
import { useOverviewKeyMetricSeriesQuery } from "@/hooks/queries/useAnalyticsOverviewQueries";
import {
  AnalyticsEmptyState,
  AnalyticsNoResults,
} from "../AnalyticsEmptyState";
import type { GrowthChartPoint } from "./GrowthRevenueChart";
import type {
  OverviewKeyMetrics as KeyMetrics,
  ChartableKeyMetric,
  AnalyticsDateRangeParams,
} from "@/types";
import { parseCalendarDate } from "@/lib/dateUtils";

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

function pct(cur: number, prev: number): number {
  if (!prev) return 0;
  return Math.round(((cur - prev) / Math.abs(prev)) * 100);
}

// "new_users" + "revenue" chart from /trends/users; the rest from /key-metrics/series.
type MetricKey = "new_users" | "revenue" | ChartableKeyMetric;

const CARDS: {
  key: MetricKey;
  label: string;
  money?: boolean;
  fromTrends?: boolean;
  revenueOnly?: boolean;
}[] = [
  { key: "new_users", label: "New users", fromTrends: true },
  {
    key: "revenue",
    label: "Revenue",
    money: true,
    fromTrends: true,
    revenueOnly: true,
  },
  { key: "link_views", label: "Link views" },
  { key: "installs", label: "App installs" },
  { key: "link_driven_installs", label: "Link-driven installs" },
  { key: "organic_installs", label: "Organic installs" },
  { key: "app_opens", label: "App opens" },
  { key: "referred_users", label: "Referred users" },
];

const chartConfig = {
  value: { label: "Current", color: "var(--chart-users)" },
  previous: { label: "Previous", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

interface Props {
  projectId: string | undefined;
  keyMetrics?: KeyMetrics;
  keyMetricsPrev?: KeyMetrics;
  /** Daily new-users + revenue series (from /overview/trends/users). */
  trends?: GrowthChartPoint[];
  revenueTotalCents: number;
  revenuePrevCents: number;
  revenueEnabled: boolean;
  /** Current range for the /series call (metric appended per selection). */
  seriesBaseParams: AnalyticsDateRangeParams;
  /** Previous equal-length range — drives the comparison line for count metrics. */
  seriesPrevParams?: AnalyticsDateRangeParams;
  loading?: boolean;
  trendsLoading?: boolean;
  hasFilters?: boolean;
}

export function OverviewKeyMetrics({
  projectId,
  keyMetrics,
  keyMetricsPrev,
  trends,
  revenueTotalCents,
  revenuePrevCents,
  revenueEnabled,
  seriesBaseParams,
  seriesPrevParams,
  loading = false,
  trendsLoading = false,
  hasFilters = false,
}: Props) {
  const [selected, setSelected] = useState<MetricKey>("new_users");

  const isSeries = selected !== "new_users" && selected !== "revenue";
  const isMoney = selected === "revenue";

  // Count metrics: fetch current + previous range so we can overlay a comparison
  // line, mirroring what /trends/users gives new users for free.
  const seriesCur = useOverviewKeyMetricSeriesQuery(
    projectId,
    isSeries && seriesBaseParams.start_date
      ? { ...seriesBaseParams, metric: selected }
      : undefined
  );
  const seriesPrev = useOverviewKeyMetricSeriesQuery(
    projectId,
    isSeries && seriesPrevParams?.start_date
      ? { ...seriesPrevParams, metric: selected }
      : undefined
  );

  const chartData = useMemo<
    { date: string; value: number; previous?: number }[]
  >(() => {
    if (selected === "new_users") {
      return (trends ?? []).map((p) => ({
        date: p.date,
        value: p.users,
        previous: p.previousUsers,
      }));
    }
    if (selected === "revenue") {
      return (trends ?? []).map((p) => ({
        date: p.date,
        value: p.revenue ?? 0,
      }));
    }
    const cur = seriesCur.data?.points ?? [];
    const prev = seriesPrev.data?.points ?? [];
    // Both ranges are equal-length + zero-filled → align previous by index.
    return cur.map((p, i) => ({
      date: p.date,
      value: p.value,
      previous: prev[i]?.value,
    }));
  }, [selected, trends, seriesCur.data, seriesPrev.data]);

  const hasPrevious = chartData.some((d) => typeof d.previous === "number");
  const chartLoading = isSeries ? seriesCur.isLoading : trendsLoading;

  const cards = CARDS.filter((c) => !c.revenueOnly || revenueEnabled);

  const cardNumber = (key: MetricKey): number =>
    key === "revenue"
      ? revenueTotalCents
      : (keyMetrics?.[key as keyof KeyMetrics] ?? 0);
  const cardPrev = (key: MetricKey): number =>
    key === "revenue"
      ? revenuePrevCents
      : (keyMetricsPrev?.[key as keyof KeyMetrics] ?? 0);
  const cardDisplay = (key: MetricKey, n: number): string =>
    key === "revenue" ? formatCurrencyFromCents(n) : numberFormatter.format(n);

  const moneyAxis = (value: number | string) => {
    const n = Number(value);
    return `$${n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n}`;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-sidebar-border bg-background">
      <div className="p-5">
        <div className="mb-3 flex flex-wrap gap-2.5">
          {loading
            ? cards.map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-[66px] min-w-[150px] flex-1 rounded-[10px]"
                />
              ))
            : cards.map((c) => {
                const cur = cardNumber(c.key);
                const delta = pct(cur, cardPrev(c.key));
                const active = selected === c.key;
                const Trend = delta < 0 ? TrendingDown : TrendingUp;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setSelected(c.key)}
                    aria-pressed={active}
                    className={cn(
                      "flex min-w-[150px] flex-1 flex-col gap-1 rounded-[10px] border bg-background px-3 py-2 text-left transition-colors",
                      active
                        ? "border-[var(--chart-users)]/40 bg-[var(--chart-users)]/[0.05]"
                        : "border-sidebar-border opacity-60 hover:opacity-100"
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          active
                            ? "bg-[var(--chart-users)]"
                            : "bg-muted-foreground/40"
                        )}
                      />
                      {c.label}
                    </span>
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold tabular-nums tracking-tight">
                        {cardDisplay(c.key, cur)}
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
              })}
        </div>

        {chartLoading && chartData.length === 0 ? (
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
        ) : chartData.length === 0 ? (
          hasFilters ? (
            <AnalyticsNoResults />
          ) : (
            <AnalyticsEmptyState
              icon={Activity}
              title="No activity yet"
              description="Track users, link views, installs, and opens over time. Integrate the Grovs SDK and this chart will fill in."
              sdkDescription="No activity recorded in this range yet."
              linkHref="/developers"
              linkLabel="Set up the SDK"
            />
          )
        ) : (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 12, left: 6, bottom: 0 }}
            >
              <defs>
                <linearGradient id="fillKeyMetric" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-value)"
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-value)"
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
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                width={54}
                allowDecimals={false}
                tickFormatter={isMoney ? moneyAxis : formatAxisNumber}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    valueFormatter={
                      isMoney
                        ? (v: number) => moneyAxis(v)
                        : numberFormatter.format
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
        )}
      </div>
    </div>
  );
}
