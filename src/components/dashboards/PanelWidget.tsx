"use client";

import { useMemo } from "react";
import { Link2, Megaphone } from "lucide-react";
import { AcquisitionChannels } from "@/components/analytics/overview/AcquisitionChannels";
import { MetricGroupPanel } from "@/components/analytics/overview/OverviewMetricGroups";
import { OverviewTopList } from "@/components/analytics/overview/OverviewTopList";
import type { QueryFilter } from "@/components/analytics/events/types";
import { TrendAreaChart } from "@/components/analytics/overview/TrendAreaChart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useOverviewKeyMetricSeriesQuery,
  useOverviewKeyMetricsQuery,
  useOverviewUserTrendsQuery,
} from "@/hooks/queries/useAnalyticsOverviewQueries";
import { useRetentionSummaryQuery } from "@/hooks/queries/useAnalyticsRetentionQueries";
import { useTopLinksQuery } from "@/hooks/queries/useDashboardQueries";
import { useCampaignsListQuery } from "@/hooks/queries/useCampaignsQueries";
import { metricQueryBlockReason } from "@/lib/metricQuery";
import { getAnalyticsErrorInfo } from "@/lib/analyticsLimits";
import type { RowTarget } from "@/lib/widgetRowTarget";
import {
  toMetricsOverview,
  topCampaignItems,
  topCampaignsParams,
  topLinkItems,
  topLinksParams,
} from "@/lib/topLists";
import { newUsersSeries, toTrendChartPoints } from "@/lib/trendPoints";
import type {
  AnalyticsDateRangeParams,
  AnalyticsGranularity,
  PanelKey,
  StoredFilter,
} from "@/types";
import {
  mergeFilterList,
  previousRangeParams,
  withMergedFilters,
  type WidgetRangeLimits,
} from "./widgetLayout";
import { KpiRowPanel, type KpiPanelKey } from "./KpiRowPanel";

type Props = {
  projectId: string | undefined;
  panel: PanelKey;
  /** Page params: dates, platform and (ignored here) the page's filter JSON. */
  base: AnalyticsDateRangeParams;
  pageFilters: ReadonlyArray<QueryFilter | StoredFilter>;
  /** The widget's own chips; only key-metrics and trend panels use them. */
  filters: StoredFilter[];
  limits: WidgetRangeLimits;
  revenueEnabled: boolean;
  /** Page granularity; only the trend panels use it. */
  granularity: AnalyticsGranularity;
  /** Top links / campaigns rows open their link or campaign. */
  onRowClick?: (target: RowTarget) => void;
};

/** Panels sit inside a WidgetFrame, so they drop their own card chrome. */
const BARE = "rounded-none border-0 bg-transparent p-0 dark:bg-transparent";

const Blocked = ({ text }: { text: string }) => (
  <p className="text-xs text-muted-foreground">{text}</p>
);

function useMergedParams({ base, pageFilters, filters }: Props) {
  const merged = useMemo(
    () => mergeFilterList(pageFilters, filters),
    [pageFilters, filters]
  );
  const params = useMemo(() => withMergedFilters(base, merged), [base, merged]);
  return { merged, params };
}

function KeyMetricsPanel(props: Props) {
  const { projectId, panel, limits, revenueEnabled } = props;
  const { merged, params } = useMergedParams(props);
  // Same raw-events rules as the key-metrics endpoint.
  const blocked = metricQueryBlockReason(
    { metric: "unique_visitors" },
    merged,
    limits
  );
  const revenueOff = panel === "revenue" && !revenueEnabled;
  const query = useOverviewKeyMetricsQuery(
    projectId,
    params,
    !blocked && !revenueOff
  );
  const metrics = useMemo(
    () => toMetricsOverview(query.data?.metrics),
    [query.data]
  );

  if (blocked && !revenueOff) return <Blocked text={blocked} />;
  if (panel === "acquisition_channels")
    return (
      <AcquisitionChannels
        className={BARE}
        hideHeader
        metrics={metrics?.current}
        loading={query.isFetching}
      />
    );
  const group =
    panel === "acquisition" || panel === "engagement" || panel === "revenue"
      ? panel
      : "acquisition";
  return (
    <MetricGroupPanel
      group={group}
      metrics={metrics}
      revenueEnabled={revenueEnabled}
      loading={!revenueOff && query.isFetching}
    />
  );
}

function UserTrendsPanel(props: Props) {
  const { projectId, limits, granularity } = props;
  const { merged, params } = useMergedParams(props);
  const trendParams = useMemo(
    () => ({ ...params, granularity }),
    [params, granularity]
  );
  // The trends endpoint also scans the previous period, so judge the cold check from prevFrom.
  const blocked = metricQueryBlockReason(
    { metric: "unique_visitors", compare: true },
    merged,
    limits
  );
  const query = useOverviewUserTrendsQuery(projectId, trendParams, !blocked);
  const data = useMemo(
    () => newUsersSeries(toTrendChartPoints(query.data?.points ?? [])),
    [query.data]
  );

  if (blocked) return <Blocked text={blocked} />;
  if (query.isFetching && data.length === 0)
    return <Skeleton className="h-[200px] w-full" />;
  if (data.length === 0)
    return <Blocked text="No new users in this date range." />;
  return <TrendAreaChart data={data} granularity={granularity} height={200} />;
}

function KpisPanel(props: Props) {
  const { projectId, limits } = props;
  const { merged, params } = useMergedParams(props);
  const prevParams = useMemo(() => previousRangeParams(params), [params]);
  // The previous period is read too, so judge the cold check from prevFrom.
  const blocked = metricQueryBlockReason(
    { metric: "unique_visitors", compare: true },
    merged,
    limits
  );
  if (blocked) return <Blocked text={blocked} />;
  return (
    <KpiRowPanel
      projectId={projectId}
      panel={props.panel as KpiPanelKey}
      params={params}
      prevParams={prevParams}
      enabled
    />
  );
}

const REVENUE_UNSUPPORTED = "Revenue can't be filtered by these filters.";

function RevenueTrendPanel(props: Props) {
  const { projectId, limits, granularity } = props;
  const { merged, params } = useMergedParams(props);
  // The revenue series only honours platform filters.
  const blocked = merged.some((f) => f.field !== "platform")
    ? REVENUE_UNSUPPORTED
    : metricQueryBlockReason(
        { metric: "unique_visitors", compare: true },
        merged,
        limits
      );
  const prevParams = useMemo(() => previousRangeParams(params), [params]);
  const cur = useOverviewKeyMetricSeriesQuery(
    projectId,
    !blocked && params.start_date
      ? { ...params, metric: "revenue", granularity }
      : undefined
  );
  const prev = useOverviewKeyMetricSeriesQuery(
    projectId,
    !blocked && prevParams
      ? { ...prevParams, metric: "revenue", granularity }
      : undefined
  );
  // Both ranges are equal-length and zero-filled, so the previous aligns by index; cents → dollars.
  const data = useMemo(() => {
    const prevPoints = prev.data?.points ?? [];
    return (cur.data?.points ?? []).map((p, i) => ({
      date: p.date,
      value: p.value / 100,
      previous: prevPoints[i] != null ? prevPoints[i].value / 100 : undefined,
    }));
  }, [cur.data, prev.data]);

  if (blocked) return <Blocked text={blocked} />;
  if (cur.error) {
    const info = getAnalyticsErrorInfo(cur.error);
    return (
      <div className="rounded-md border border-dashed border-destructive/30 bg-destructive/5 px-3 py-2">
        <p className="text-xs font-medium text-destructive">{info.title}</p>
        <p className="text-[11px] text-muted-foreground">{info.description}</p>
      </div>
    );
  }
  if (cur.data?.unsupported) return <Blocked text={REVENUE_UNSUPPORTED} />;
  if (cur.isFetching && data.length === 0)
    return <Skeleton className="h-[200px] w-full" />;
  if (data.length === 0)
    return <Blocked text="No revenue in this date range." />;
  return (
    <TrendAreaChart data={data} granularity={granularity} money height={200} />
  );
}

function RetentionPanel({ projectId, base }: Props) {
  const params = useMemo(
    () => ({
      start_date: base.start_date,
      end_date: base.end_date,
      platform: base.platform,
    }),
    [base.start_date, base.end_date, base.platform]
  );
  const query = useRetentionSummaryQuery(projectId, params, true);
  return (
    <MetricGroupPanel
      group="retention"
      metrics={undefined}
      retention={query.data}
      revenueEnabled={false}
      loading={query.isFetching}
    />
  );
}

function TopLinksPanel({ projectId, base, onRowClick }: Props) {
  const params = useMemo(() => topLinksParams(base), [base]);
  const query = useTopLinksQuery(projectId, params);
  return (
    <OverviewTopList
      className={BARE}
      title="Links"
      viewAllHref="/dynamic_links/links"
      items={topLinkItems(query.data)}
      unitLabel="views"
      loading={query.isFetching}
      onItemClick={
        onRowClick ? (id) => onRowClick({ kind: "link", id }) : undefined
      }
      empty={{
        icon: Link2,
        title: "No link views",
        description: "No link was viewed in this date range.",
        href: "/dynamic_links/links",
        label: "Open links",
      }}
    />
  );
}

function TopCampaignsPanel({ projectId, base, onRowClick }: Props) {
  const params = useMemo(() => topCampaignsParams(base), [base]);
  const query = useCampaignsListQuery(projectId, params);
  return (
    <OverviewTopList
      className={BARE}
      title="Campaigns"
      viewAllHref="/dynamic_links/campaigns"
      items={topCampaignItems(query.data?.data)}
      unitLabel="views"
      loading={query.isFetching}
      onItemClick={
        onRowClick ? (id) => onRowClick({ kind: "campaign", id }) : undefined
      }
      empty={{
        icon: Megaphone,
        title: "No campaign views",
        description: "No campaign was viewed in this date range.",
        href: "/dynamic_links/campaigns",
        label: "Open campaigns",
      }}
    />
  );
}

/** Renders one Overview panel as a widget body; each panel runs exactly one query. */
export function PanelWidget(props: Props) {
  switch (props.panel) {
    case "user_trends":
      return <UserTrendsPanel {...props} />;
    case "retention":
      return <RetentionPanel {...props} />;
    case "top_links":
      return <TopLinksPanel {...props} />;
    case "top_campaigns":
      return <TopCampaignsPanel {...props} />;
    case "kpis_acquisition":
    case "kpis_engagement":
    case "kpis_revenue":
    case "kpis_links":
      return <KpisPanel {...props} />;
    case "revenue_trend":
      return <RevenueTrendPanel {...props} />;
    default:
      return <KeyMetricsPanel {...props} />;
  }
}
