"use client";

import { useCallback, useMemo } from "react";
import {
  endOfDay,
  endOfYear,
  startOfDay,
  startOfYear,
  sub,
  differenceInCalendarDays,
} from "date-fns";
import {
  useTableParams,
  platformFromQueryFilters,
} from "@/hooks/useTableParams";
import AppHeader from "@/components/layout/app-header";
import { DateRangePicker } from "@/components/dateRangePicker/DateRangePicker";
import type { Preset } from "@/components/dateRangePicker/DateRangePicker";
import { AnalyticsNotice } from "@/components/analytics/AnalyticsNotice";
import { useScaleUpDialog } from "@/hooks/useScaleUpDialog";
import { retentionMinDate, getAnalyticsErrorInfo } from "@/lib/analyticsLimits";
import type { GrowthChartPoint } from "./GrowthRevenueChart";
import { OverviewKeyMetrics } from "./OverviewKeyMetrics";
import { OverviewMetricGroups } from "./OverviewMetricGroups";
import { AcquisitionChannels } from "./AcquisitionChannels";
import { OverviewTopList } from "./OverviewTopList";
import QuickStartGuide from "@/components/dashboard/QuickStartGuide";
import { formatDateParam } from "@/lib/utils";
import {
  formatApiStartOfDay,
  formatApiEndOfDay,
  formatApiDate,
} from "@/lib/dateUtils";
import { SectionLabel } from "@/components/common/SectionLabel";
import { Link2, Megaphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useProjectSelection } from "@/context/useProjectSelection";
import { useGlobalLinkDialog } from "@/context/useLinkDialogContext";
import { useGlobalDialog } from "@/context/useCreateCampaignDialogContext";
import { useCreateCampaignMutation } from "@/hooks/mutations/useCampaignsMutations";
import QueryBar from "@/components/analytics/events/QueryBar";
import type { QueryFilter } from "@/components/analytics/events/types";
import {
  useOverviewUserTrendsQuery,
  useOverviewKeyMetricsQuery,
} from "@/hooks/queries/useAnalyticsOverviewQueries";
import { useRetentionSummaryQuery } from "@/hooks/queries/useAnalyticsRetentionQueries";
import { useTopLinksQuery } from "@/hooks/queries/useDashboardQueries";
import { useCampaignsListQuery } from "@/hooks/queries/useCampaignsQueries";
import type {
  AnalyticsRetention,
  AnalyticsOverviewParams,
  AnalyticsDateRangeParams,
  DateRangeQuery,
  GetCampaignsParams,
  MetricsOverview,
  MetricValues,
  OverviewKeyMetrics as OverviewKeyMetricsData,
} from "@/types";
import { isUnlimitedRetentionPlan } from "@/types";

const overviewDefaultDateRange = (() => {
  const now = new Date();
  return {
    from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    to: now,
  };
})();

function analyticsDatePresets(retention: AnalyticsRetention | undefined) {
  const queryableDays = retention?.queryable_days;
  const presets: Preset[] = [
    { label: "Today", value: 0, duration: "days" },
    { label: "Last week", value: 1, duration: "weeks" },
    { label: "Last month", value: 1, duration: "months" },
  ];

  if (!queryableDays || queryableDays >= 90) {
    presets.push({ label: "Last 3 months", value: 3, duration: "months" });
  }
  if (!queryableDays || queryableDays >= 180) {
    presets.push({ label: "Last 6 months", value: 6, duration: "months" });
  }
  if (!queryableDays || queryableDays >= 365) {
    presets.push({
      label: "Current year",
      range: (now) => ({ from: startOfYear(now), to: endOfDay(now) }),
    });
  }
  if (!queryableDays || queryableDays >= 730) {
    presets.push(
      {
        label: "Last year",
        range: (now) => {
          const lastYear = sub(now, { years: 1 });
          return {
            from: startOfYear(lastYear),
            to: endOfYear(lastYear),
          };
        },
      },
      {
        label: "Last 2 years",
        range: (now) => ({
          from: startOfDay(sub(now, { years: 2 })),
          to: endOfDay(now),
        }),
      }
    );
  }

  return presets;
}

function analyticsHistoryLabel(retention: AnalyticsRetention): string {
  if (retention.plan === "enterprise") return "Enterprise history available.";
  if (isUnlimitedRetentionPlan(retention.plan))
    return `${retention.queryable_days}-day history available.`;
  if (retention.queryable_days >= 365) return "Annual history available.";
  if (retention.queryable_days >= 90) return "Quarterly history available.";
  return `${retention.queryable_days}-day history available.`;
}

export default function AnalyticsOverviewPage() {
  const { selectedProject, selectedInstance, getStartedSetup } =
    useProjectSelection();
  const projectId = selectedProject?.id;
  const router = useRouter();
  const { openLinkDialog, openEditLinkDialog } = useGlobalLinkDialog();
  const { openDialog: openCreateCampaignDialog } = useGlobalDialog();
  const createCampaignMutation = useCreateCampaignMutation(
    projectId,
    selectedInstance?.id
  );

  // Create a campaign from the empty state, then jump straight to its detail
  // page — same flow as the campaigns list.
  const handleCreateCampaign = async (name: string) => {
    try {
      const response = await createCampaignMutation.mutateAsync({ name });
      const newCampaign = response.data?.campaign;
      if (newCampaign?.id) {
        router.push(`/dynamic_links/campaigns/${newCampaign.id}`);
      }
    } catch {
      // Mutation surfaces its own error notification.
    }
  };

  // Onboarding banner — shown until the instance dismisses it or all setup
  // steps are complete. Carried over from the old dashboard.
  const allStepsDone = useMemo(() => {
    if (!getStartedSetup) return false;
    return (
      getStartedSetup.android_sdk &&
      getStartedSetup.ios_sdk &&
      getStartedSetup.has_created_campaigns &&
      getStartedSetup.has_created_links &&
      getStartedSetup.redirect_fallback
    );
  }, [getStartedSetup]);
  const showOnboarding =
    !selectedInstance?.get_started_dismissed && !allStepsDone;
  const retention = selectedInstance?.analytics_retention;
  const { openScaleUp, scaleUpDialog } = useScaleUpDialog();
  const minDate = useMemo(
    () => retentionMinDate(retention, new Date()),
    [retention]
  );
  const datePresets = useMemo(
    () => analyticsDatePresets(retention),
    [retention]
  );

  // URL-backed filter state — shared mechanism with the Events explorer.
  const {
    dateRange,
    setDateRange,
    queryFilters,
    setQueryFilters,
    clearAllFilters,
  } = useTableParams({ defaultDateRange: overviewDefaultDateRange });

  // Platform is just another QueryBar chip — derive it, no separate URL key.
  const platform = useMemo(
    () => platformFromQueryFilters(queryFilters),
    [queryFilters]
  );

  // The overview rollups carry no dimension but platform, so stale URL chips are dropped.
  const platformFilters = useMemo<QueryFilter[]>(
    () =>
      platform
        ? [
            {
              id: `platform_is_${platform}`,
              field: "platform",
              value: platform,
              operator: "is",
            },
          ]
        : [],
    [platform]
  );

  const setPlatformFilter = useCallback(
    (field: string, value: string) =>
      setQueryFilters([
        { id: `${field}_is_${value}`, field, value, operator: "is" },
      ]),
    [setQueryFilters]
  );

  // Events-based analytics endpoint (user trends): date + platform.
  const overviewParams = useMemo<AnalyticsOverviewParams>(() => {
    const p: AnalyticsOverviewParams = {};
    if (dateRange?.from) p.start_date = formatDateParam(dateRange.from);
    if (dateRange?.to) p.end_date = formatDateParam(dateRange.to);
    if (platform) p.platform = platform;
    return p;
  }, [dateRange, platform]);

  // Dashboard metrics / links endpoints (reused, dashboard untouched).
  const metricsParams = useMemo<DateRangeQuery | null>(() => {
    if (!dateRange?.from || !dateRange?.to) return null;
    const p: DateRangeQuery = {
      start_date: formatApiStartOfDay(dateRange.from),
      end_date: formatApiEndOfDay(dateRange.to),
    };
    if (platform) p.platform = platform;
    return p;
  }, [dateRange, platform]);

  const campaignsParams = useMemo<GetCampaignsParams | null>(() => {
    if (!dateRange?.from) return null;
    const p: GetCampaignsParams = {
      archived: false,
      ascending: false,
      page: 1,
      start_date: formatApiDate(dateRange.from),
      sort_by: "views",
      per_page: 5,
    };
    if (dateRange.to) p.end_date = formatApiDate(dateRange.to);
    return p;
  }, [dateRange]);

  // Key-metrics / series endpoints take only date + platform (no filters/search).
  const keyMetricsParams = useMemo<AnalyticsDateRangeParams>(() => {
    const p: AnalyticsDateRangeParams = {};
    if (dateRange?.from) p.start_date = formatDateParam(dateRange.from);
    if (dateRange?.to) p.end_date = formatDateParam(dateRange.to);
    if (platform) p.platform = platform;
    return p;
  }, [dateRange, platform]);

  // Previous equal-length range for period-over-period deltas.
  const keyMetricsPrevParams = useMemo<
    AnalyticsDateRangeParams | undefined
  >(() => {
    if (!dateRange?.from || !dateRange?.to) return undefined;
    const days = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
    const prevTo = sub(dateRange.from, { days: 1 });
    const prevFrom = sub(prevTo, { days: days - 1 });
    const p: AnalyticsDateRangeParams = {
      start_date: formatDateParam(prevFrom),
      end_date: formatDateParam(prevTo),
    };
    if (platform) p.platform = platform;
    return p;
  }, [dateRange, platform]);

  const trendsQuery = useOverviewUserTrendsQuery(projectId, overviewParams);
  const keyMetricsQuery = useOverviewKeyMetricsQuery(
    projectId,
    keyMetricsParams
  );
  const keyMetricsPrevQuery = useOverviewKeyMetricsQuery(
    projectId,
    keyMetricsPrevParams,
    !!keyMetricsPrevParams
  );
  const retentionQuery = useRetentionSummaryQuery(projectId, overviewParams);
  const topLinksQuery = useTopLinksQuery(projectId, metricsParams);
  const campaignsQuery = useCampaignsListQuery(projectId, campaignsParams);

  // Legacy MetricsOverview shape, now assembled from the fast CH key-metrics
  // endpoint (current + previous ranges) instead of the slow PG metrics_overview.
  // Only rename needed: CH exposes organic installs as `organic_installs`.
  const metricsOverview = useMemo<MetricsOverview | undefined>(() => {
    const cur = keyMetricsQuery.data?.metrics;
    if (!cur) return undefined;
    const toValues = (m: OverviewKeyMetricsData): MetricValues => ({
      ...m,
      organic_users: m.organic_installs,
    });
    const prev = keyMetricsPrevQuery.data?.metrics;
    return { current: toValues(cur), previous: toValues(prev ?? cur) };
  }, [keyMetricsQuery.data, keyMetricsPrevQuery.data]);

  const metricsLoading =
    keyMetricsQuery.isFetching || keyMetricsPrevQuery.isFetching;
  const hasFilters = platformFilters.length > 0;

  // Reactive: surface limit errors from the events-based queries (trends /
  // retention), branched on error_code.
  const overviewError =
    trendsQuery.error || retentionQuery.error || keyMetricsQuery.error
      ? getAnalyticsErrorInfo(
          trendsQuery.error ?? retentionQuery.error ?? keyMetricsQuery.error
        )
      : null;

  // Show revenue metrics when the instance collects revenue, or when the data
  // actually contains revenue — don't hide real numbers behind the edition flag.
  const hasRevenueData =
    (metricsOverview?.current.revenue ?? 0) > 0 ||
    (metricsOverview?.current.units_sold ?? 0) > 0 ||
    (metricsOverview?.current.arpu ?? 0) > 0;
  const revenueEnabled =
    !!selectedInstance?.revenue_collection_enabled || hasRevenueData;

  const chartData = useMemo<GrowthChartPoint[] | undefined>(() => {
    if (!trendsQuery.data) return undefined;
    return trendsQuery.data.points.map((p) => ({
      date: p.date,
      users: p.new_users ?? p.users ?? 0,
      previousUsers: p.previous_new_users ?? p.previous_users ?? 0,
      revenue:
        p.revenue_usd_cents != null ? p.revenue_usd_cents / 100 : undefined,
    }));
  }, [trendsQuery.data]);

  const topLinkItems = useMemo(
    () =>
      [...(topLinksQuery.data ?? [])]
        .sort((a, b) => b.views - a.views)
        .slice(0, 5)
        .map((l) => ({
          id: l.id,
          name: l.name,
          value: l.views,
          revenueCents: l.revenue_cents,
        })),
    [topLinksQuery.data]
  );

  const topCampaignItems = useMemo(
    () =>
      [...(campaignsQuery.data?.data ?? [])]
        .sort((a, b) => b.total_views - a.total_views)
        .slice(0, 5)
        .map((c) => ({
          id: c.id,
          name: c.name,
          value: c.total_views,
          revenueCents: c.total_revenue,
        })),
    [campaignsQuery.data]
  );

  return (
    <main className="flex flex-col relative overflow-hidden h-dvh">
      <AppHeader titleOverride="Dashboard" />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col overflow-hidden min-w-0 w-full">
          <div className="@container/main flex-1 overflow-auto">
            <div className="flex flex-col gap-8 p-6">
              {showOnboarding && <QuickStartGuide />}

              {/* Toolbar — unchanged: filter bar + calendar */}
              <div className="flex w-full items-center gap-3 flex-wrap">
                <QueryBar
                  platformOnly
                  projectId={projectId}
                  queryFilters={platformFilters}
                  onAddFilter={setPlatformFilter}
                  onRemoveFilter={clearAllFilters}
                  onClearAll={clearAllFilters}
                />
                <DateRangePicker
                  date={dateRange}
                  setDate={setDateRange}
                  presets={datePresets}
                  minDate={minDate}
                  footer={
                    retention ? (
                      <div className="pt-2 mt-1 border-t border-sidebar-border">
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          {analyticsHistoryLabel(retention)}
                        </p>
                        {!isUnlimitedRetentionPlan(retention.plan) && (
                          <button
                            type="button"
                            onClick={openScaleUp}
                            className="text-[11px] font-medium text-[color:var(--chart-users)] hover:underline"
                          >
                            Upgrade for more
                          </button>
                        )}
                      </div>
                    ) : undefined
                  }
                />
              </div>

              {overviewError && (
                <AnalyticsNotice
                  variant="error"
                  title={overviewError.title}
                  description={overviewError.description}
                  onUpgrade={
                    overviewError.isRetention &&
                    retention &&
                    !isUnlimitedRetentionPlan(retention.plan)
                      ? openScaleUp
                      : undefined
                  }
                  onRetry={
                    overviewError.isHeavy
                      ? () => {
                          trendsQuery.refetch();
                          retentionQuery.refetch();
                        }
                      : undefined
                  }
                />
              )}

              {/* Unified activity chart — click any metric to chart it, with a
                  previous-period comparison line. */}
              <OverviewKeyMetrics
                projectId={projectId}
                keyMetrics={keyMetricsQuery.data?.metrics}
                keyMetricsPrev={keyMetricsPrevQuery.data?.metrics}
                trends={chartData}
                revenueTotalCents={metricsOverview?.current.revenue ?? 0}
                revenuePrevCents={metricsOverview?.previous.revenue ?? 0}
                revenueEnabled={revenueEnabled}
                seriesBaseParams={keyMetricsParams}
                seriesPrevParams={keyMetricsPrevParams}
                loading={keyMetricsQuery.isLoading || metricsLoading}
                trendsLoading={trendsQuery.isFetching}
                hasFilters={hasFilters}
              />

              {/* Where users came from */}
              <section className="flex flex-col gap-4">
                <div className="flex flex-col gap-0.5">
                  <SectionLabel>Where users came from</SectionLabel>
                  <span className="text-[12.5px] text-muted-foreground">
                    Which channels and campaigns drive your installs
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 @3xl/main:grid-cols-3">
                  <AcquisitionChannels
                    metrics={metricsOverview?.current}
                    loading={metricsLoading}
                  />
                  <OverviewTopList
                    title="Top links"
                    viewAllHref="/dynamic_links/links"
                    items={topLinkItems}
                    unitLabel="views"
                    loading={topLinksQuery.isFetching}
                    onItemClick={(id) => openEditLinkDialog({ id }, {})}
                    empty={{
                      icon: Link2,
                      title: "No links yet",
                      description:
                        "Create a deep link and share it to start tracking views and installs.",
                      href: "/dynamic_links/links",
                      label: "Create a link",
                      onAction: () =>
                        openLinkDialog({
                          onSuccess: () => topLinksQuery.refetch(),
                        }),
                    }}
                  />
                  <OverviewTopList
                    title="Top campaigns"
                    viewAllHref="/dynamic_links/campaigns"
                    items={topCampaignItems}
                    unitLabel="views"
                    loading={campaignsQuery.isFetching}
                    onItemClick={(id) =>
                      router.push(`/dynamic_links/campaigns/${id}`)
                    }
                    empty={{
                      icon: Megaphone,
                      title: "No campaigns yet",
                      description:
                        "Launch a campaign to group your links and measure what drives growth.",
                      href: "/dynamic_links/campaigns",
                      label: "Create a campaign",
                      onAction: () =>
                        openCreateCampaignDialog({
                          onConfirm: (name: unknown) =>
                            handleCreateCampaign(name as string),
                        }),
                    }}
                  />
                </div>
              </section>

              {/* Supporting metrics — grouped by stage */}
              <OverviewMetricGroups
                metrics={metricsOverview}
                revenueEnabled={revenueEnabled}
                retention={retentionQuery.data}
                loading={metricsLoading || retentionQuery.isFetching}
              />
            </div>
          </div>
        </div>
      </div>

      {scaleUpDialog}
    </main>
  );
}
