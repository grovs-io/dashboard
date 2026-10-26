"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  endOfDay,
  endOfYear,
  startOfDay,
  startOfYear,
  sub,
  differenceInCalendarDays,
} from "date-fns";
import { useTableParams } from "@/hooks/useTableParams";
import AppHeader from "@/components/layout/app-header";
import { DateRangePicker } from "@/components/dateRangePicker/DateRangePicker";
import type { Preset } from "@/components/dateRangePicker/DateRangePicker";
import { AnalyticsNotice } from "@/components/analytics/AnalyticsNotice";
import { useScaleUpDialog } from "@/hooks/useScaleUpDialog";
import {
  retentionMinDate,
  getAnalyticsErrorInfo,
  isHeavyQueryShape,
  heavyShapeHitsCold,
  VOLUME_MAX_DAYS,
} from "@/lib/analyticsLimits";
import type { TrendChartPoint } from "./types";
import {
  METRIC_KEYS,
  OverviewKeyMetrics,
  type MetricKey,
} from "./OverviewKeyMetrics";
import { BreakdownPanel, DEFAULT_DIMENSION } from "./BreakdownPanel";
import { OverviewMetricGroups } from "./OverviewMetricGroups";
import { AcquisitionChannels } from "./AcquisitionChannels";
import { OverviewTopList } from "./OverviewTopList";
import { SectionLabel } from "@/components/common/SectionLabel";
import { Copy, Link2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useProjectSelection } from "@/context/useProjectSelection";
import { useGlobalLinkDialog } from "@/context/useLinkDialogContext";
import { useGlobalDialog } from "@/context/useCreateCampaignDialogContext";
import { useCreateCampaignMutation } from "@/hooks/mutations/useCampaignsMutations";
import QueryBar from "@/components/analytics/events/QueryBar";
import { useUrlState } from "@/hooks/useUrlState";
import { useOverviewQueryParams } from "@/hooks/useOverviewQueryParams";
import { useOverviewPrefs } from "@/hooks/useOverviewPrefs";
import { GranularityToggle } from "./GranularityToggle";
import {
  chooseGranularity,
  defaultGranularity,
  isGranularity,
} from "@/lib/analyticsGranularity";
import { buildExplorerHref } from "@/lib/explorerLink";
import { toTrendChartPoints } from "@/lib/trendPoints";
import {
  useOverviewUserTrendsQuery,
  useOverviewKeyMetricsQuery,
} from "@/hooks/queries/useAnalyticsOverviewQueries";
import { useRetentionSummaryQuery } from "@/hooks/queries/useAnalyticsRetentionQueries";
import { useTopLinksQuery } from "@/hooks/queries/useDashboardQueries";
import { useCampaignsListQuery } from "@/hooks/queries/useCampaignsQueries";
import { useDashboardsQuery } from "@/hooks/queries/useDashboardsQueries";
import { useSdkStatusQuery } from "@/hooks/queries/useSdkStatusQuery";
import {
  useCopyDashboardMutation,
  useCreateDashboardMutation,
  useUpdateDashboardMutation,
  useCreateWidgetMutation,
  useUpdateWidgetMutation,
} from "@/hooks/mutations/useDashboardsMutations";
import {
  DashboardPicker,
  MAX_DASHBOARDS,
} from "@/components/dashboards/DashboardPicker";
import { BuiltinBoard } from "@/components/dashboards/BuiltinBoard";
import { DashboardSetupPanel } from "@/components/dashboards/DashboardSetupPanel";
import { needsSetup } from "@/lib/sdkStatus";
import {
  builtinDashboard,
  widgetPayload,
  type BuiltinDashboard,
  type BuiltinWidget,
} from "@/components/dashboards/builtinDashboards";
import {
  CopyDashboardDialog,
  type CopyResult,
} from "@/components/dashboards/CopyDashboardDialog";
import { markNewBoard } from "@/components/dashboards/newBoardHint";
import type { RowTarget } from "@/lib/widgetRowTarget";
import { DashboardNameDialog } from "@/components/dashboards/DashboardNameDialog";
import { DashboardBoard } from "@/components/dashboards/DashboardBoard";
import {
  WidgetDialog,
  type WidgetDialogSubmit,
} from "@/components/dashboards/WidgetDialog";
import type { WidgetRangeLimits } from "@/components/dashboards/widgetLayout";
import {
  showErrorNotification,
  showGenericError,
  showSuccessNotification,
} from "@/lib/Notifications";
import { getApiErrorMessage } from "@/lib/apiErrorHelpers";
import type {
  AnalyticsRetention,
  DashboardWidget,
  MetricQueryMetric,
  MetricsOverview,
} from "@/types";
import {
  toMetricsOverview,
  topCampaignItems,
  topLinkItems,
} from "@/lib/topLists";
import { isUnlimitedRetentionPlan } from "@/types";
import type { WidgetInitial } from "@/schemas/dashboard";

const OVERVIEW = builtinDashboard("")!;

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
  const { selectedProject, selectedInstance } = useProjectSelection();
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

  const {
    dateRange,
    setDateRange,
    queryFilters,
    addFilter,
    removeFilter,
    clearAllFilters,
  } = useTableParams({ defaultDateRange: overviewDefaultDateRange });

  const [granularityParam, setGranularityParam] = useUrlState(
    "granularity",
    "auto"
  );
  const granularity = isGranularity(granularityParam)
    ? granularityParam
    : defaultGranularity(dateRange?.from, dateRange?.to);

  // Selected metric card lives in the URL so a filtered view of one metric is shareable.
  const [metricParam, setMetricParam] = useUrlState("metric", "new_users");
  const selectedMetric: MetricKey = (METRIC_KEYS as readonly string[]).includes(
    metricParam
  )
    ? (metricParam as MetricKey)
    : "new_users";

  // BreakdownPanel owns this URL param; read here too so it can be restored and remembered.
  const [dimensionParam, setBreakdownParam] = useUrlState(
    "breakdown",
    DEFAULT_DIMENSION
  );

  // Selected dashboard lives in the URL too, so a board view is shareable/bookmarkable.
  const [board, setBoard] = useUrlState("board", "");
  const dashboardsQuery = useDashboardsQuery(projectId);
  const dashboards = dashboardsQuery.data ?? [];
  // "" (Overview) is built in too; `builtin` is set only for the other four.
  const builtin = board ? builtinDashboard(board) : undefined;
  const activeDashboard = builtin
    ? undefined
    : dashboards.find((d) => String(d.id) === board);
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const createDashboard = useCreateDashboardMutation(projectId);
  const [renameOpen, setRenameOpen] = useState(false);
  const updateDashboard = useUpdateDashboardMutation(projectId);

  // Selections are remembered per project; date range and filters stay URL-only.
  const searchParams = useSearchParams();
  const { prefs, remember, loaded: prefsLoaded } = useOverviewPrefs(projectId);
  // Keyed by project so a project switch restores again instead of a one-shot flag blocking it.
  const restoredForRef = useRef<string | undefined>(undefined);
  // State twin of the ref, so the overview can hold its queries until the board is restored.
  const [boardRestoredFor, setBoardRestoredFor] = useState<string>();
  useEffect(() => {
    if (!prefsLoaded || restoredForRef.current === projectId) return;
    restoredForRef.current = projectId;
    setBoardRestoredFor(projectId);
    if (!searchParams.has("metric") && prefs.metric)
      setMetricParam(prefs.metric);
    if (!searchParams.has("granularity") && prefs.granularity)
      setGranularityParam(prefs.granularity);
    if (!searchParams.has("breakdown") && prefs.breakdown)
      setBreakdownParam(prefs.breakdown);
    if (!searchParams.has("board") && prefs.dashboard)
      setBoard(prefs.dashboard);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once per project
  }, [prefsLoaded, projectId]);

  // Skips the first render per project: the restore above hasn't round-tripped the URL yet.
  const dimensionMountedForRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!prefsLoaded) return;
    if (dimensionMountedForRef.current !== projectId) {
      dimensionMountedForRef.current = projectId;
      return;
    }
    if (dimensionParam === prefs.breakdown) return;
    remember({ breakdown: dimensionParam });
  }, [dimensionParam, prefsLoaded, projectId, prefs.breakdown, remember]);

  const [widgetDialog, setWidgetDialogState] = useState<
    | { mode: "create"; prefill?: WidgetInitial; dashboardId?: number }
    | { mode: "edit"; widget: DashboardWidget }
    | null
  >(null);
  // Each open gets a fresh dialog instance, so it never previews the previous session's values.
  const [widgetSession, setWidgetSession] = useState(0);
  const setWidgetDialog = (next: typeof widgetDialog) => {
    if (next) setWidgetSession((n) => n + 1);
    setWidgetDialogState(next);
  };

  const selectBoard = (value: string) => {
    setBoard(value);
    remember({ dashboard: value });
  };

  const copyDashboard = useCopyDashboardMutation(projectId);
  const [copying, setCopying] = useState<BuiltinDashboard | null>(null);
  const handleCopy = async (
    name: string,
    widgets: BuiltinWidget[]
  ): Promise<CopyResult> => {
    const { dashboard, failed } = await copyDashboard.mutateAsync({
      name,
      widgets: widgets.map(widgetPayload),
    });
    if (!failed.length) markNewBoard(dashboard.id);
    return { id: dashboard.id, failed: failed.map((f) => f.title) };
  };
  const openCopiedBoard = (id: number) => {
    setCopying(null);
    selectBoard(String(id));
  };

  const handleRowClick = (target: RowTarget) => {
    if (target.kind === "campaign")
      router.push(`/dynamic_links/campaigns/${target.id}`);
    else if (target.kind === "link") openEditLinkDialog({ id: target.id }, {});
    else router.push(target.href);
  };

  const handleCreateDashboard = async (name: string) => {
    try {
      const created = await createDashboard.mutateAsync({ name });
      setNameDialogOpen(false);
      showSuccessNotification("Dashboard created");
      selectBoard(String(created.id));
    } catch {
      showGenericError();
    }
  };

  // Only reachable from a board, so a dashboard always exists here.
  const requestWidget = (prefill?: WidgetInitial, dashboardId?: number) => {
    setWidgetDialog({ mode: "create", prefill, dashboardId });
  };

  const handleRenameDashboard = async (name: string) => {
    if (!activeDashboard) return;
    try {
      await updateDashboard.mutateAsync({
        dashboardId: activeDashboard.id,
        payload: { name },
      });
      setRenameOpen(false);
      showSuccessNotification("Dashboard renamed");
    } catch {
      showGenericError();
    }
  };

  const createWidget = useCreateWidgetMutation(projectId);
  const updateWidget = useUpdateWidgetMutation(projectId);

  const handleWidgetSubmit = async ({
    dashboardId,
    payload,
  }: WidgetDialogSubmit) => {
    try {
      if (widgetDialog?.mode === "edit") {
        await updateWidget.mutateAsync({
          dashboardId: widgetDialog.widget.dashboard_id,
          widgetId: widgetDialog.widget.id,
          payload,
        });
      } else if (dashboardId) {
        await createWidget.mutateAsync({ dashboardId, payload });
      } else {
        return;
      }
      setWidgetDialog(null);
      if (dashboardId) setBoard(String(dashboardId));
      showSuccessNotification(
        widgetDialog?.mode === "edit" ? "Widget updated" : "Widget added"
      );
    } catch (err) {
      showErrorNotification(
        getApiErrorMessage(err, "Couldn't save the widget. Please try again.")
      );
    }
  };

  const params = useOverviewQueryParams(dateRange, queryFilters, granularity);
  const { hasNonPlatformFilters } = params;

  // Mirrors the backend raw-cap check exactly: (end_date - start_date) > cap.
  const rangeSpanDays =
    dateRange?.from && dateRange?.to
      ? differenceInCalendarDays(dateRange.to, dateRange.from)
      : 0;
  // Trends also scan the previous period, so the cold gate must judge that earlier start.
  const prevFrom =
    dateRange?.from && dateRange?.to
      ? sub(dateRange.from, { days: rangeSpanDays + 1 })
      : dateRange?.from;
  const heavyIntoCold = heavyShapeHitsCold(
    retention,
    prevFrom,
    isHeavyQueryShape(undefined, queryFilters),
    new Date()
  );

  const rawMaxDays = retention?.raw_max_days ?? VOLUME_MAX_DAYS;
  const filteredRangeTooLong =
    hasNonPlatformFilters && rangeSpanDays > rawMaxDays;
  const canQuery = !filteredRangeTooLong && !heavyIntoCold;
  // Breakdown, widgets and the widget preview gate per query on these instead of canQuery.
  const limits: WidgetRangeLimits = {
    rangeSpanDays,
    retention,
    from: dateRange?.from,
    prevFrom,
  };

  // A deep-linked board may still be loading; hold the overview's queries until we know.
  const showingBoard =
    !!builtin || (!!board && (dashboardsQuery.isPending || !!activeDashboard));
  // Holds the overview until the remembered dashboard, if any, has been restored.
  const restoringBoard =
    !prefsLoaded ||
    (boardRestoredFor !== projectId &&
      !searchParams.has("board") &&
      !!prefs.dashboard);
  const setupDashboard = builtin ?? (showingBoard ? undefined : OVERVIEW);
  const sdkStatusQuery = useSdkStatusQuery(
    projectId,
    setupDashboard?.setup ?? null
  );
  const sdkStatus = sdkStatusQuery.data;
  const showSetup =
    !!setupDashboard &&
    !!sdkStatus &&
    needsSetup(setupDashboard.setup, sdkStatus);
  const overviewVisible = !showingBoard && !showSetup && !restoringBoard;
  const overviewEnabled = canQuery && overviewVisible;

  const trendsQuery = useOverviewUserTrendsQuery(
    projectId,
    params.trends,
    overviewEnabled
  );
  const keyMetricsQuery = useOverviewKeyMetricsQuery(
    projectId,
    params.base,
    overviewEnabled
  );
  const keyMetricsPrevQuery = useOverviewKeyMetricsQuery(
    projectId,
    params.prev,
    overviewEnabled && !!params.prev
  );
  const retentionParams = useMemo(
    () => ({
      start_date: params.base.start_date,
      end_date: params.base.end_date,
      platform: params.base.platform,
    }),
    [params.base.start_date, params.base.end_date, params.base.platform]
  );
  const retentionQuery = useRetentionSummaryQuery(
    projectId,
    retentionParams,
    overviewVisible
  );
  const topLinksQuery = useTopLinksQuery(
    projectId,
    overviewVisible ? params.metrics : null
  );
  const campaignsQuery = useCampaignsListQuery(
    projectId,
    overviewVisible ? params.campaigns : null
  );

  const unsupportedMetrics = useMemo(
    () => (canQuery ? (keyMetricsQuery.data?.unsupported_metrics ?? []) : []),
    [keyMetricsQuery.data, canQuery]
  );

  const explorerHref = useMemo(
    () =>
      buildExplorerHref({
        from: dateRange?.from,
        to: dateRange?.to,
        filters: queryFilters,
        metric: selectedMetric,
      }),
    [dateRange, queryFilters, selectedMetric]
  );

  const metricsOverview = useMemo<MetricsOverview | undefined>(
    () =>
      canQuery
        ? toMetricsOverview(
            keyMetricsQuery.data?.metrics,
            keyMetricsPrevQuery.data?.metrics
          )
        : undefined,
    [keyMetricsQuery.data, keyMetricsPrevQuery.data, canQuery]
  );

  const metricsLoading =
    keyMetricsQuery.isFetching || keyMetricsPrevQuery.isFetching;
  const hasFilters = queryFilters.length > 0;

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
    (!!selectedInstance?.revenue_collection_enabled || hasRevenueData) &&
    !unsupportedMetrics.includes("revenue");

  // Filters can hide the selected card; fall back so the chart never goes blank.
  useEffect(() => {
    if (selectedMetric === "new_users") return;
    const hidden =
      unsupportedMetrics.includes(selectedMetric) ||
      (selectedMetric === "revenue" &&
        !!keyMetricsQuery.data &&
        !revenueEnabled);
    if (hidden) {
      setMetricParam("new_users");
      remember({ metric: "new_users" });
    }
  }, [
    unsupportedMetrics,
    selectedMetric,
    setMetricParam,
    keyMetricsQuery.data,
    revenueEnabled,
    remember,
  ]);

  const chartData = useMemo<TrendChartPoint[] | undefined>(
    () =>
      trendsQuery.data
        ? toTrendChartPoints(trendsQuery.data.points)
        : undefined,
    [trendsQuery.data]
  );

  const topLinks = useMemo(
    () => topLinkItems(topLinksQuery.data),
    [topLinksQuery.data]
  );
  const topCampaigns = useMemo(
    () => topCampaignItems(campaignsQuery.data?.data),
    [campaignsQuery.data]
  );

  return (
    <main className="flex flex-col relative overflow-hidden h-dvh">
      <AppHeader titleOverride="Home" />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col overflow-hidden min-w-0 w-full">
          <div className="@container/main flex-1 overflow-auto">
            <div className="flex flex-col gap-8 p-6">
              <div className="flex w-full items-center gap-3 flex-wrap">
                <DashboardPicker
                  dashboards={dashboards}
                  active={board}
                  onSelect={selectBoard}
                  onCreate={() => setNameDialogOpen(true)}
                />
                <QueryBar
                  projectId={projectId}
                  queryFilters={queryFilters}
                  onAddFilter={addFilter}
                  onRemoveFilter={removeFilter}
                  onClearAll={clearAllFilters}
                />
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <DateRangePicker
                    date={dateRange}
                    setDate={setDateRange}
                    presets={datePresets}
                    minDate={minDate}
                    header={
                      <GranularityToggle
                        value={granularity}
                        onChange={(g) => {
                          const current =
                            dateRange?.from && dateRange?.to
                              ? { from: dateRange.from, to: dateRange.to }
                              : undefined;
                          const { range: next, param } = chooseGranularity(
                            g,
                            current,
                            new Date(),
                            minDate
                          );
                          setGranularityParam(param);
                          remember({ granularity: param });
                          if (next && next !== current) setDateRange(next);
                        }}
                      />
                    }
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
                  {builtin && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 gap-2"
                      onClick={() => setCopying(builtin)}
                    >
                      <Copy className="size-4" />
                      Copy to customise
                    </Button>
                  )}
                  {activeDashboard && (
                    <div
                      ref={setActionsHost}
                      className="flex items-center gap-2"
                    />
                  )}
                </div>
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
                          keyMetricsQuery.refetch();
                        }
                      : undefined
                  }
                />
              )}

              {!showingBoard && filteredRangeTooLong && (
                <AnalyticsNotice
                  variant="warning"
                  title={`Headline metrics with filters are limited to ${rawMaxDays} days`}
                  description={`The cards and trend above use the ${rawMaxDays}-day filtered window; breakdowns and widgets have their own limits.`}
                />
              )}
              {!showingBoard && !filteredRangeTooLong && heavyIntoCold && (
                <AnalyticsNotice
                  variant="warning"
                  title="Some filters can't reach older data"
                  description="“contains” and “is not” filters only run on recent data for your plan. Narrow the range or remove them."
                  onUpgrade={
                    retention && !isUnlimitedRetentionPlan(retention.plan)
                      ? openScaleUp
                      : undefined
                  }
                />
              )}

              {showSetup && setupDashboard && sdkStatus ? (
                <DashboardSetupPanel
                  dashboard={setupDashboard.key}
                  status={sdkStatus}
                  onCreateLink={() =>
                    openLinkDialog({
                      onSuccess: () => sdkStatusQuery.refetch(),
                    })
                  }
                />
              ) : builtin ? (
                <BuiltinBoard
                  key={builtin.key}
                  dashboard={builtin}
                  projectId={projectId}
                  base={params.base}
                  pageFilters={queryFilters}
                  granularity={granularity}
                  limits={limits}
                  onRowClick={handleRowClick}
                />
              ) : !showingBoard ? (
                <>
                  {/* Unified activity chart — click any metric to chart it, with a
                      previous-period comparison line. */}
                  <OverviewKeyMetrics
                    projectId={projectId}
                    keyMetrics={
                      canQuery ? keyMetricsQuery.data?.metrics : undefined
                    }
                    keyMetricsPrev={
                      canQuery ? keyMetricsPrevQuery.data?.metrics : undefined
                    }
                    trends={chartData}
                    revenueTotalCents={metricsOverview?.current.revenue ?? 0}
                    revenuePrevCents={metricsOverview?.previous.revenue ?? 0}
                    revenueEnabled={revenueEnabled}
                    seriesBaseParams={params.base}
                    seriesPrevParams={params.prev}
                    seriesEnabled={canQuery}
                    loading={keyMetricsQuery.isLoading || metricsLoading}
                    trendsLoading={trendsQuery.isFetching}
                    hasFilters={hasFilters}
                    selected={selectedMetric}
                    onSelect={(k) => {
                      setMetricParam(k);
                      remember({ metric: k });
                    }}
                    granularity={granularity}
                    unsupportedMetrics={unsupportedMetrics}
                    explorerHref={explorerHref}
                  />

                  {/* Mounted only once prefs are loaded so the panel seeds from them and fires one query. */}
                  {prefsLoaded && (
                    <BreakdownPanel
                      projectId={projectId}
                      base={params.base}
                      filters={queryFilters}
                      limits={limits}
                      cardMetric={selectedMetric}
                      granularity={granularity}
                      onAddFilter={addFilter}
                      initial={{
                        metric: prefs.breakdownMetric?.[selectedMetric] as
                          | MetricQueryMetric
                          | undefined,
                        timeline: prefs.timeline,
                        compare: prefs.compare,
                        limit: prefs.top,
                      }}
                      onChange={(state) =>
                        remember({
                          breakdownMetric: state.metric
                            ? {
                                ...prefs.breakdownMetric,
                                [selectedMetric]: state.metric,
                              }
                            : prefs.breakdownMetric,
                          timeline: state.timeline,
                          compare: state.compare,
                          top: state.limit,
                        })
                      }
                    />
                  )}

                  {/* Where users came from */}
                  <section className="flex flex-col gap-4">
                    <div className="flex flex-col gap-0.5">
                      <SectionLabel>Where users came from</SectionLabel>
                      <span className="text-[12.5px] text-muted-foreground">
                        {hasNonPlatformFilters
                          ? "Channels follow your filters. Retention, top links and campaigns reflect only the date range and platform."
                          : "Which channels and campaigns drive your installs"}
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
                        items={topLinks}
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
                        items={topCampaigns}
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
                </>
              ) : activeDashboard ? (
                <DashboardBoard
                  key={activeDashboard.id}
                  dashboard={activeDashboard}
                  projectId={projectId}
                  base={params.base}
                  pageFilters={queryFilters}
                  granularity={granularity}
                  limits={limits}
                  revenueEnabled={
                    !!selectedInstance?.revenue_collection_enabled
                  }
                  onAddWidget={() =>
                    requestWidget(undefined, activeDashboard.id)
                  }
                  onCreateWidget={async (payload) => {
                    await createWidget.mutateAsync({
                      dashboardId: activeDashboard.id,
                      payload,
                    });
                    showSuccessNotification("Widget added");
                  }}
                  onEditWidget={(w) =>
                    setWidgetDialog({ mode: "edit", widget: w })
                  }
                  onRename={() => setRenameOpen(true)}
                  onDeleted={() => selectBoard("")}
                  onRowClick={handleRowClick}
                  actionsHost={actionsHost}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {copying && (
        <CopyDashboardDialog
          key={copying.key}
          dashboard={copying}
          atLimit={dashboards.length >= MAX_DASHBOARDS}
          onClose={() => setCopying(null)}
          onCreate={handleCopy}
          onOpenBoard={openCopiedBoard}
        />
      )}

      <DashboardNameDialog
        open={nameDialogOpen}
        title="New dashboard"
        initialName="My dashboard"
        pending={createDashboard.isPending}
        onOpenChange={setNameDialogOpen}
        onSubmit={handleCreateDashboard}
      />

      <DashboardNameDialog
        open={renameOpen}
        title="Rename dashboard"
        initialName={activeDashboard?.name ?? ""}
        pending={updateDashboard.isPending}
        onOpenChange={setRenameOpen}
        onSubmit={handleRenameDashboard}
      />

      <WidgetDialog
        key={widgetDialog ? `session-${widgetSession}` : "closed"}
        open={!!widgetDialog}
        onOpenChange={(o) => !o && setWidgetDialog(null)}
        projectId={projectId}
        dashboards={dashboards}
        base={params.base}
        granularity={granularity}
        initial={
          widgetDialog?.mode === "create" ? widgetDialog.prefill : undefined
        }
        widget={widgetDialog?.mode === "edit" ? widgetDialog.widget : undefined}
        defaultDashboardId={
          widgetDialog?.mode === "create" ? widgetDialog.dashboardId : undefined
        }
        filters={
          widgetDialog?.mode === "edit" ? widgetDialog.widget.filters : []
        }
        limits={limits}
        revenueEnabled={!!selectedInstance?.revenue_collection_enabled}
        pending={createWidget.isPending || updateWidget.isPending}
        onSubmit={handleWidgetSubmit}
      />

      {scaleUpDialog}
    </main>
  );
}
