"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Activity, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatCurrencyFromCents } from "@/utils/formatCurrency";
import { useOverviewKeyMetricSeriesQuery } from "@/hooks/queries/useAnalyticsOverviewQueries";
import {
  AnalyticsEmptyState,
  AnalyticsNoResults,
} from "../AnalyticsEmptyState";
import { numberFormatter, formatCompactNumber, pct } from "./metricFormat";
import { TrendAreaChart, type TrendDatum } from "./TrendAreaChart";
import type { TrendChartPoint } from "./types";
import { newUsersSeries } from "@/lib/trendPoints";
import type {
  OverviewKeyMetrics as KeyMetrics,
  ChartableKeyMetric,
  AnalyticsDateRangeParams,
  AnalyticsGranularity,
} from "@/types";

// "new_users" + "revenue" chart from /trends/users; the rest from /key-metrics/series.
export type MetricKey = "new_users" | "revenue" | ChartableKeyMetric;

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

export const METRIC_KEYS: readonly MetricKey[] = CARDS.map((c) => c.key);

interface Props {
  projectId: string | undefined;
  keyMetrics?: KeyMetrics;
  keyMetricsPrev?: KeyMetrics;
  /** New-users + revenue series at the selected granularity (from /overview/trends/users). */
  trends?: TrendChartPoint[];
  revenueTotalCents: number;
  revenuePrevCents: number;
  revenueEnabled: boolean;
  /** Current range for the /series call (metric appended per selection). */
  seriesBaseParams: AnalyticsDateRangeParams;
  /** Previous equal-length range — drives the comparison line for count metrics. */
  seriesPrevParams?: AnalyticsDateRangeParams;
  /** False when the range/filter combo would 422 the raw-events series endpoint. */
  seriesEnabled: boolean;
  loading?: boolean;
  trendsLoading?: boolean;
  hasFilters?: boolean;
  selected: MetricKey;
  onSelect: (key: MetricKey) => void;
  granularity: AnalyticsGranularity;
  /** Metric keys the backend returned as 0 because of the active filters — hidden. */
  unsupportedMetrics: string[];
  /** Events Explorer deep link for the selected metric and current chips. */
  explorerHref: string;
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
  seriesEnabled,
  loading = false,
  trendsLoading = false,
  hasFilters = false,
  selected,
  onSelect,
  granularity,
  unsupportedMetrics,
  explorerHref,
}: Props) {
  const isSeries = selected !== "new_users" && selected !== "revenue";
  const isMoney = selected === "revenue";

  // Count metrics: fetch current + previous range so we can overlay a comparison
  // line, mirroring what /trends/users gives new users for free.
  const seriesCur = useOverviewKeyMetricSeriesQuery(
    projectId,
    isSeries && seriesEnabled && seriesBaseParams.start_date
      ? { ...seriesBaseParams, metric: selected, granularity }
      : undefined
  );
  const seriesPrev = useOverviewKeyMetricSeriesQuery(
    projectId,
    isSeries && seriesEnabled && seriesPrevParams?.start_date
      ? { ...seriesPrevParams, metric: selected, granularity }
      : undefined
  );

  const chartData = useMemo<TrendDatum[]>(() => {
    if (selected === "new_users") return newUsersSeries(trends ?? []);
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

  const chartLoading = isSeries ? seriesCur.isLoading : trendsLoading;

  const cards = CARDS.filter(
    (c) =>
      (!c.revenueOnly || revenueEnabled) && !unsupportedMetrics.includes(c.key)
  );

  const cardNumber = (key: MetricKey): number =>
    key === "revenue"
      ? revenueTotalCents
      : (keyMetrics?.[key as keyof KeyMetrics] ?? 0);
  const cardPrev = (key: MetricKey): number =>
    key === "revenue"
      ? revenuePrevCents
      : (keyMetricsPrev?.[key as keyof KeyMetrics] ?? 0);
  const cardDisplay = (key: MetricKey, n: number): string =>
    key === "revenue" ? formatCurrencyFromCents(n) : formatCompactNumber(n);

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
                    onClick={() => onSelect(c.key)}
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
                    <span className="flex flex-wrap items-baseline gap-1.5">
                      <span
                        className="text-lg font-bold tabular-nums tracking-tight"
                        title={
                          c.key === "revenue"
                            ? undefined
                            : numberFormatter.format(cur)
                        }
                      >
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

        <div className="mb-2 flex justify-end">
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
          >
            <Link href={explorerHref}>
              Explore events
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
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
              linkHref="/settings/developers"
              linkLabel="Set up the SDK"
            />
          )
        ) : (
          <TrendAreaChart
            data={chartData}
            granularity={granularity}
            money={isMoney}
          />
        )}
      </div>
    </div>
  );
}
