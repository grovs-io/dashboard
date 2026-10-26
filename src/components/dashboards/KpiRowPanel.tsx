"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { DeltaPill } from "@/components/analytics/widgets/NumberWidget";
import {
  formatCompactNumber,
  numberFormatter,
} from "@/components/analytics/overview/metricFormat";
import { formatCurrencyFromCents } from "@/utils/formatCurrency";
import { useOverviewKeyMetricsQuery } from "@/hooks/queries/useAnalyticsOverviewQueries";
import { useRetentionSummaryQuery } from "@/hooks/queries/useAnalyticsRetentionQueries";
import type {
  AnalyticsDateRangeParams,
  OverviewKeyMetrics,
  RetentionSummaryResponse,
  StoredFilter,
} from "@/types";

export type KpiPanelKey =
  | "kpis_acquisition"
  | "kpis_engagement"
  | "kpis_revenue"
  | "kpis_links";

type Format = "count" | "money" | "ratio" | "percent";
type Kpi = {
  key: string;
  label: string;
  format: Format;
  /** KM fields the value is read from; any unsupported one blanks the tile. */
  fields: (keyof OverviewKeyMetrics)[];
  value: (
    m: OverviewKeyMetrics,
    r: RetentionSummaryResponse | undefined
  ) => number | null;
  highlight?: boolean;
  /** Read from the retention summary; blank when the filters can't apply there. */
  retention?: boolean;
};

const field = (
  k: keyof OverviewKeyMetrics,
  label: string,
  format: Format = "count"
): Kpi => ({ key: k, label, format, fields: [k], value: (m) => m[k] });

/** link_driven_installs / link_views; null when nothing was viewed. */
export function viewToInstall(
  m: Pick<OverviewKeyMetrics, "link_views" | "link_driven_installs">
): number | null {
  return m.link_views > 0 ? m.link_driven_installs / m.link_views : null;
}

const conversion: Kpi = {
  key: "view_to_install",
  label: "View → install",
  format: "ratio",
  fields: ["link_views", "link_driven_installs"],
  value: viewToInstall,
  highlight: true,
};

export const KPI_ROWS: Record<KpiPanelKey, Kpi[]> = {
  kpis_acquisition: [
    field("new_users", "New users"),
    field("installs", "App installs"),
    field("link_driven_installs", "Link-driven installs"),
    field("organic_installs", "Organic installs"),
    field("referred_users", "Referred users"),
    conversion,
  ],
  kpis_engagement: [
    field("app_opens", "App opens"),
    field("returning_users", "Returning users"),
    field("returning_rate", "Returning rate", "ratio"),
    {
      key: "day_7",
      label: "Day 7 retention",
      format: "percent",
      fields: [],
      retention: true,
      value: (_m, r) => r?.day_7 ?? null,
    },
  ],
  kpis_revenue: [
    field("revenue", "Revenue", "money"),
    field("arpu", "ARPU", "money"),
    field("arppu", "ARPPU", "money"),
    field("units_sold", "Units sold"),
    field("first_time_purchases", "First-time purchases"),
  ],
  kpis_links: [
    field("link_views", "Link views"),
    field("link_driven_installs", "Link-driven installs"),
    field("opens", "App opens from links"),
    field("referred_users", "Referred users"),
    conversion,
  ],
};

export function formatKpi(format: Format, v: number | null): string {
  if (v == null) return "—";
  if (format === "money") return formatCurrencyFromCents(v);
  if (format === "ratio") return `${(v * 100).toFixed(1)}%`;
  if (format === "percent") return `${v.toFixed(1)}%`;
  return formatCompactNumber(v);
}

/** Retention only honours one platform; null when the filters need more. */
export function retentionParams(p: AnalyticsDateRangeParams | undefined) {
  if (!p) return undefined;
  let filters: StoredFilter[];
  try {
    filters = p.filters ? JSON.parse(p.filters) : [];
  } catch {
    return null;
  }
  const platforms = new Set(
    filters.map((f) =>
      f.field === "platform" && f.operator === "is" ? f.value : null
    )
  );
  if (platforms.has(null) || platforms.size > 1) return null;
  const [platform] = platforms;
  return {
    start_date: p.start_date,
    end_date: p.end_date,
    platform: platform ?? p.platform,
  };
}

/** A row of key-metric tiles with the change against the previous period. */
export function KpiRowPanel({
  projectId,
  panel,
  params,
  prevParams,
  enabled,
}: {
  projectId: string | undefined;
  panel: KpiPanelKey;
  params: AnalyticsDateRangeParams;
  prevParams: AnalyticsDateRangeParams | undefined;
  enabled: boolean;
}) {
  const kpis = KPI_ROWS[panel];
  const cur = useOverviewKeyMetricsQuery(projectId, params, enabled);
  const prev = useOverviewKeyMetricsQuery(
    projectId,
    prevParams,
    enabled && !!prevParams
  );
  const withRetention = panel === "kpis_engagement";
  const curRetentionParams = useMemo(() => retentionParams(params), [params]);
  const prevRetentionParams = useMemo(
    () => retentionParams(prevParams),
    [prevParams]
  );
  const retentionOff = curRetentionParams === null;
  const retention = useRetentionSummaryQuery(
    projectId,
    curRetentionParams ?? undefined,
    enabled && withRetention && !retentionOff
  );
  const retentionPrev = useRetentionSummaryQuery(
    projectId,
    prevRetentionParams ?? undefined,
    enabled && withRetention && !retentionOff && !!prevParams
  );

  const loading =
    !cur.data && (cur.isFetching || (withRetention && retention.isFetching));
  const unsupported = new Set(cur.data?.unsupported_metrics ?? []);

  return (
    <div className="flex flex-wrap gap-2.5">
      {kpis.map((k) => {
        if (loading)
          return (
            <Skeleton
              key={k.key}
              className="h-[62px] min-w-[140px] flex-1 rounded-[10px]"
            />
          );
        const blank =
          (k.retention && retentionOff) ||
          k.fields.some((f) => unsupported.has(f));
        const value =
          !blank && cur.data ? k.value(cur.data.metrics, retention.data) : null;
        const previous =
          !blank && prev.data
            ? k.value(prev.data.metrics, retentionPrev.data)
            : null;
        return (
          <div
            key={k.key}
            className="flex min-w-[140px] flex-1 flex-col gap-1 rounded-[10px] px-3 py-2"
          >
            <span className="text-[11.5px] text-muted-foreground">
              {k.label}
            </span>
            <span className="flex flex-wrap items-baseline gap-1.5">
              <span
                className={cn(
                  "text-lg font-bold tabular-nums tracking-tight",
                  value == null && "font-medium text-muted-foreground",
                  k.highlight && value != null && "text-[var(--chart-users)]"
                )}
                title={
                  k.format === "count" && value != null
                    ? numberFormatter.format(value)
                    : undefined
                }
              >
                {formatKpi(k.format, value)}
              </span>
              {value != null && (
                <DeltaPill current={value} previous={previous} />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
