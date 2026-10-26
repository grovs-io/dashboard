"use client";

import {
  Activity,
  CircleDollarSign,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyFromCents } from "@/utils/formatCurrency";
import type { MetricsOverview, RetentionSummaryResponse } from "@/types";
import { numberFormatter, pct } from "./metricFormat";

type MetricMeta = { title: string; valueType?: "money" | "percent" };

const META: Record<string, MetricMeta> = {
  link_views: { title: "Link views" },
  installs: { title: "App installs" },
  app_opens: { title: "App opens" },
  returning_rate: { title: "Returning rate", valueType: "percent" },
  returning_users: { title: "Returning users" },
  arpu: { title: "Avg. Rev/User", valueType: "money" },
  arppu: { title: "Avg. Rev/Paying", valueType: "money" },
  units_sold: { title: "Units sold" },
  first_time_purchases: { title: "First-time purchasers" },
  cancellations: { title: "Cancellations" },
};

const REVENUE_KEYS = new Set([
  "arpu",
  "arppu",
  "units_sold",
  "first_time_purchases",
  "cancellations",
]);

export type MetricGroupKey =
  | "acquisition"
  | "engagement"
  | "revenue"
  | "retention";

const GROUP_LABELS: Record<MetricGroupKey, string> = {
  acquisition: "Acquisition",
  engagement: "Engagement",
  revenue: "Revenue",
  retention: "Retention",
};

const GROUP_KEYS: Record<Exclude<MetricGroupKey, "retention">, string[]> = {
  acquisition: ["link_views", "installs", "cancellations"],
  engagement: ["app_opens", "returning_users", "returning_rate"],
  revenue: ["arpu", "arppu", "units_sold", "first_time_purchases"],
};

function formatValue(key: string, value: number): string {
  const t = META[key]?.valueType;
  if (t === "money") return formatCurrencyFromCents(value);
  if (t === "percent") return `${Math.round(value * 100)}%`;
  return numberFormatter.format(value);
}

function fmtPct(v: number | null): string {
  return v == null ? "—" : `${Math.round(v)}%`;
}

function retentionRow(
  day: number,
  rate: number | null,
  users: number | undefined
): Row {
  const row: Row = { label: `Day ${day}`, value: fmtPct(rate) };
  if (rate == null) {
    row.title = `No users reached day ${day} in this range.`;
    return row;
  }
  row.title = `Users active exactly ${day} ${day === 1 ? "day" : "days"} after their first visit, among those whose day ${day} falls in this range.`;
  if (users)
    row.hint = `${numberFormatter.format(users)} ${users === 1 ? "user" : "users"}`;
  return row;
}

type Row = {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
  title?: string;
};
type GroupEmpty = {
  icon: LucideIcon;
  title: string;
  description: string;
};
type GroupContent = { rows: Row[]; empty?: GroupEmpty };

function MetricRow({
  label,
  value,
  change,
  hint,
  title,
}: Row & { change?: number }) {
  const show = change != null && change !== 0;
  const Trend = change != null && change < 0 ? TrendingDown : TrendingUp;
  return (
    <div
      className="flex items-baseline justify-between border-b border-sidebar-border/70 py-[7px] last:border-b-0"
      title={title}
    >
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-1.5">
        {hint && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {hint}
          </span>
        )}
        <span className="text-[15px] font-semibold tabular-nums">{value}</span>
        {show && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums",
              change > 0
                ? "bg-valid-green-light-2 text-valid-green dark:bg-valid-green/15 dark:text-emerald-400"
                : "bg-destructive-secondary text-destructive dark:bg-destructive/15 dark:text-red-400"
            )}
          >
            <Trend className="size-3" />
            {Math.abs(change)}%
          </span>
        )}
      </span>
    </div>
  );
}

function MetricGroupEmpty({ icon: Icon, title, description }: GroupEmpty) {
  return (
    <div className="flex min-h-[132px] flex-col items-center justify-center px-3 py-4 text-center">
      <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mb-1 text-[13px] font-medium text-foreground">{title}</p>
      <p className="max-w-[230px] text-[11.5px] leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function hasEngagement(metrics: MetricsOverview | undefined): boolean {
  if (!metrics) return false;
  return (
    metrics.current.app_opens > 0 ||
    metrics.current.returning_users > 0 ||
    metrics.current.returning_rate > 0
  );
}

function hasRetention(
  retention: RetentionSummaryResponse | undefined
): boolean {
  if (!retention) return false;
  return (
    retention.day_1 != null ||
    retention.day_7 != null ||
    retention.day_30 != null ||
    retention.median_churn_day != null ||
    retention.sparkline.length > 0
  );
}

const REVENUE_OFF: GroupEmpty = {
  icon: CircleDollarSign,
  title: "Revenue isn't tracked",
  description:
    "Turn on revenue collection for this instance to see revenue per user, units sold and purchasers.",
};

function metricRows(
  keys: string[],
  metrics: MetricsOverview | undefined,
  revenueEnabled: boolean
): Row[] {
  return keys
    .filter((k) => revenueEnabled || !REVENUE_KEYS.has(k))
    .map((k) => {
      const cur = metrics?.current[k] ?? 0;
      const prev = metrics?.previous[k] ?? 0;
      return {
        label: META[k]?.title ?? k,
        value: formatValue(k, cur),
        delta: pct(cur, prev),
      };
    });
}

function groupContent(
  group: MetricGroupKey,
  metrics: MetricsOverview | undefined,
  retention: RetentionSummaryResponse | undefined,
  revenueEnabled: boolean
): GroupContent {
  const retentionHasData = hasRetention(retention) && !!retention;
  if (group === "retention") {
    if (retentionHasData) {
      return {
        rows: [
          retentionRow(1, retention.day_1, retention.day_1_users),
          retentionRow(7, retention.day_7, retention.day_7_users),
          retentionRow(30, retention.day_30, retention.day_30_users),
        ],
      };
    }
    return {
      rows: [],
      empty: {
        icon: RotateCcw,
        title: "No retention cohorts yet",
        description:
          "Retention needs users to come back after their first session. Keep tracking active and check a later date range.",
      },
    };
  }
  if (group === "revenue" && !revenueEnabled)
    return { rows: [], empty: REVENUE_OFF };
  if (group !== "engagement")
    return { rows: metricRows(GROUP_KEYS[group], metrics, revenueEnabled) };

  // Median churn sits under Engagement; Retention keeps the D1/D7/D30 rates.
  const rows = hasEngagement(metrics)
    ? metricRows(GROUP_KEYS.engagement, metrics, revenueEnabled)
    : [];
  if (retentionHasData) {
    const churn = retention.median_churn_day;
    rows.push({
      label: "Median churn",
      value: churn == null ? "—" : `${churn} ${churn === 1 ? "day" : "days"}`,
    });
    return { rows };
  }
  if (rows.length) return { rows };
  return {
    rows,
    empty: {
      icon: Activity,
      title: "No engagement recorded",
      description:
        "Open the app with this instance's SDK active, then refresh this range once activity has been tracked.",
    },
  };
}

/** One metric group's rows (no heading), shared by the Overview grid and panel widgets. */
export function MetricGroupPanel({
  group,
  metrics,
  retention,
  revenueEnabled,
  loading,
}: {
  group: MetricGroupKey;
  metrics: MetricsOverview | undefined;
  retention?: RetentionSummaryResponse;
  revenueEnabled: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3.5 py-[7px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <Skeleton className="h-3.5 w-28" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-5 w-11 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  const { rows, empty } = groupContent(
    group,
    metrics,
    retention,
    revenueEnabled
  );
  if (empty) return <MetricGroupEmpty {...empty} />;
  return (
    <div>
      {rows.map((r) => (
        <MetricRow
          key={r.label}
          label={r.label}
          value={r.value}
          change={r.delta}
          hint={r.hint}
          title={r.title}
        />
      ))}
    </div>
  );
}

export function OverviewMetricGroups({
  metrics,
  revenueEnabled,
  retention,
  loading,
}: {
  metrics: MetricsOverview | undefined;
  revenueEnabled: boolean;
  retention?: RetentionSummaryResponse;
  loading?: boolean;
}) {
  const groups: MetricGroupKey[] = revenueEnabled
    ? ["acquisition", "engagement", "revenue", "retention"]
    : ["acquisition", "engagement", "retention"];

  return (
    <div className="overflow-hidden rounded-xl border border-sidebar-border bg-background">
      <div
        className={cn(
          "grid grid-cols-1 divide-y divide-sidebar-border @2xl/main:grid-cols-2 @4xl/main:divide-x @4xl/main:divide-y-0",
          revenueEnabled ? "@4xl/main:grid-cols-4" : "@4xl/main:grid-cols-3"
        )}
      >
        {groups.map((g) => (
          <div key={g} className="p-5">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {GROUP_LABELS[g]}
            </div>
            <MetricGroupPanel
              group={g}
              metrics={metrics}
              retention={retention}
              revenueEnabled={revenueEnabled}
              loading={loading}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
