"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import {
  useTableParams,
  platformFromQueryFilters,
} from "@/hooks/useTableParams";
import DataTable from "@/components/common/DataTable";
import CustomizeColumns from "@/components/common/customize-columns";
import { DateRangePicker } from "@/components/dateRangePicker/DateRangePicker";
import { AnalyticsNotice } from "../AnalyticsNotice";
import { useScaleUpDialog } from "@/hooks/useScaleUpDialog";
import {
  VOLUME_MAX_DAYS,
  retentionMinDate,
  isHeavyQueryShape,
  heavyShapeHitsCold,
  getAnalyticsErrorInfo,
} from "@/lib/analyticsLimits";
import { differenceInCalendarDays, startOfDay, endOfDay, sub } from "date-fns";
import { Activity, BarChart3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AnalyticsEmptyState } from "../AnalyticsEmptyState";
import EventVolumeChart from "./EventVolumeChart";
import EventDetailSheet from "./EventDetailSheet";
import AudienceItemDetailsDialog from "@/components/audience/AudienceItemDetailsDialog";
import QueryBar from "./QueryBar";
import {
  getEventsTableColumns,
  COLUMN_OPTIONS,
  DEFAULT_VISIBLE_COLUMNS,
} from "./EventsTableColumns";
import type { EventOccurrence, EventTableRow } from "./types";
import { useProjectSelection } from "@/context/useProjectSelection";
import {
  useAnalyticsEventsInfiniteQuery,
  useAnalyticsEventVolumeQuery,
} from "@/hooks/queries/useAnalyticsEventsQueries";
import type {
  AnalyticsEventsParams,
  AnalyticsEventVolumeParams,
} from "@/types";
import { isUnlimitedRetentionPlan } from "@/types";

const EVENTS_DATE_PRESETS = [
  { label: "Last hour", value: 1, duration: "hours" as const },
  { label: "Last 6 hours", value: 6, duration: "hours" as const },
  { label: "Today", value: 0, duration: "days" as const },
  { label: "Last week", value: 1, duration: "weeks" as const },
  { label: "Last month", value: 1, duration: "months" as const },
  {
    label: "Last 3 months",
    range: (now: Date) => ({
      from: startOfDay(sub(now, { days: VOLUME_MAX_DAYS - 1 })),
      to: endOfDay(now),
    }),
  },
];

const VALID_CATEGORIES = new Set<EventOccurrence["category"]>([
  "engagement",
  "lifecycle",
  "revenue",
  "navigation",
  "system",
]);
function toEventCategory(value: string): EventOccurrence["category"] {
  return VALID_CATEGORIES.has(value as EventOccurrence["category"])
    ? (value as EventOccurrence["category"])
    : "system";
}

// Sort fields the events endpoint accepts. A sort carried over from another
// table (e.g. the Links table's `views`) is invalid here and would 400.
const EVENTS_SORT_FIELDS = new Set([
  "created_at",
  "event_type",
  "event_name",
  "platform",
]);

const defaultEventsDateRange = (() => {
  const now = new Date();
  return { from: startOfDay(now), to: endOfDay(now) };
})();

function rangeExceedsEventsWindow(
  range: { from?: Date; to?: Date } | undefined
): boolean {
  if (!range?.from || !range?.to) return false;
  return (
    differenceInCalendarDays(startOfDay(range.to), startOfDay(range.from)) + 1 >
    VOLUME_MAX_DAYS
  );
}

function rangeHasInvalidOrder(
  range: { from?: Date; to?: Date } | undefined
): boolean {
  return !!range?.from && !!range?.to && range.from > range.to;
}

const VIEWER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

// The picker's `to` is inclusive; the API range is half-open. created_at is
// DateTime64(3), so the next millisecond is the next representable instant.
function exclusiveEnd(to: Date): string {
  return new Date(to.getTime() + 1).toISOString();
}

export default function EventsExplorer() {
  const { selectedProject, selectedInstance } = useProjectSelection();
  const projectId = selectedProject?.id;
  const retention = selectedInstance?.analytics_retention;
  const { openScaleUp, scaleUpDialog } = useScaleUpDialog();

  // Oldest selectable date for this plan — bounds the picker proactively.
  const minDate = useMemo(
    () => retentionMinDate(retention, new Date()),
    [retention]
  );

  const {
    sort,
    setSort,
    searchTerm,
    setSearchTerm,
    dateRange,
    setDateRange,
    isDefaultDateRange,
    queryFilters,
    addFilter,
    removeFilter,
    clearAllFilters,
  } = useTableParams({
    defaultSortKey: "created_at",
    defaultDateRange: defaultEventsDateRange,
  });

  // Platform is just another QueryBar chip — derive it, no separate URL key.
  const platform = useMemo(
    () => platformFromQueryFilters(queryFilters),
    [queryFilters]
  );

  const [selectedEvent, setSelectedEvent] = useState<EventOccurrence | null>(
    null
  );
  const [visitorOpen, setVisitorOpen] = useState<{ id: string } | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    DEFAULT_VISIBLE_COLUMNS
  );
  const [showGraph, setShowGraph] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("events_show_graph") !== "false";
  });
  const rangeTooLarge = rangeExceedsEventsWindow(dateRange);
  const rangeOrderInvalid = rangeHasInvalidOrder(dateRange);

  // Build API params from URL-backed state
  const eventsParams = useMemo<AnalyticsEventsParams>(() => {
    const p: AnalyticsEventsParams = { timezone: VIEWER_TIMEZONE };
    if (dateRange?.from) p.start_date = dateRange.from.toISOString();
    if (dateRange?.to) p.end_date = exclusiveEnd(dateRange.to);
    if (searchTerm) p.search = searchTerm;
    // Platform scoping travels inside `filters`; the events endpoint ignores a
    // top-level `platform` param, so don't send it.
    // Only send a sort this endpoint accepts — otherwise omit and let the
    // backend default to created_at desc (guards against a stale cross-table sort).
    if (sort.sortKey && EVENTS_SORT_FIELDS.has(sort.sortKey)) {
      p.sort_by = sort.sortKey;
      p.sort_order = sort.ascending ? "asc" : "desc";
    }
    if (queryFilters.length > 0) {
      p.filters = JSON.stringify(
        queryFilters.map((f) => ({
          field: f.field,
          operator: f.operator,
          value: f.value,
        }))
      );
    }
    return p;
  }, [dateRange, searchTerm, sort, queryFilters]);

  // Events uses the same 90-day max window for the table and histogram so the
  // two surfaces never disagree about the selected period.
  const volumeParams = useMemo<AnalyticsEventVolumeParams>(() => {
    const p: AnalyticsEventVolumeParams = { timezone: VIEWER_TIMEZONE };
    if (dateRange?.from) p.start_date = dateRange.from.toISOString();
    if (dateRange?.to) p.end_date = exclusiveEnd(dateRange.to);
    if (searchTerm) p.search = searchTerm;
    // Platform scoping travels inside `filters`; the volume endpoint takes no
    // top-level `platform` param.
    if (queryFilters.length > 0) {
      p.filters = JSON.stringify(
        queryFilters.map((f) => ({
          field: f.field,
          operator: f.operator,
          value: f.value,
        }))
      );
    }
    return p;
  }, [dateRange, searchTerm, queryFilters]);

  // A sort carried in from another table (e.g. Links' `views`) isn't valid here
  // and would 400 the endpoint — reset it to the default so the URL clears too.
  useEffect(() => {
    if (sort.sortKey && !EVENTS_SORT_FIELDS.has(sort.sortKey)) {
      setSort({ sortKey: "created_at", ascending: false });
    }
  }, [sort.sortKey, setSort]);

  const eventsQueriesEnabled = !rangeTooLarge && !rangeOrderInvalid;
  const eventsQuery = useAnalyticsEventsInfiniteQuery(
    projectId,
    eventsParams,
    eventsQueriesEnabled
  );
  const volumeQuery = useAnalyticsEventVolumeQuery(
    projectId,
    volumeParams,
    eventsQueriesEnabled
  );

  // Proactive caution: a heavy query (free-text / contains / is-not) reaching
  // into cold data will be rejected by the backend — warn before it runs.
  const coldHeavyWarning = heavyShapeHitsCold(
    retention,
    dateRange?.from,
    isHeavyQueryShape(searchTerm, queryFilters),
    new Date()
  );

  // Reactive: surface backend limit errors (retention_window_exceeded,
  // query_too_heavy) branched on error_code.
  const eventsError = eventsQuery.error
    ? getAnalyticsErrorInfo(eventsQuery.error)
    : null;
  const volumeError = volumeQuery.error
    ? getAnalyticsErrorInfo(volumeQuery.error)
    : null;

  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Flatten all pages into a single list of EventOccurrence
  const sorted = useMemo<EventOccurrence[]>(() => {
    if (!eventsQuery.data?.pages) return [];
    const seen = new Set<string>();
    return eventsQuery.data.pages.flatMap((page) =>
      (page.data ?? []).reduce<EventOccurrence[]>((acc, e) => {
        if (seen.has(e.event_id)) return acc;
        seen.add(e.event_id);
        acc.push({
          id: e.event_id,
          event_type: e.event_type,
          event_name: e.event_name || e.event_type,
          category: toEventCategory(e.event_type),
          timestamp: e.created_at,
          user_id: String(e.visitor_id || ""),
          visitor_uuid: e.visitor_uuid ?? null,
          resolved_visitor_id: e.resolved_visitor_id ?? null,
          session_id: e.session_id || "",
          platform: e.platform,
          device_model: e.device_model,
          os_version: e.os_version,
          app_version: e.app_version,
          country: e.country,
          city: e.city,
          properties: (e.properties ?? {}) as Record<
            string,
            string | number | boolean
          >,
        });
        return acc;
      }, [])
    );
  }, [eventsQuery.data]);

  const hasMore = eventsQuery.hasNextPage;

  // Scroll to top when filters change
  const filterKey = `${searchTerm}|${platform}|${dateRange?.from?.getTime()}|${dateRange?.to?.getTime()}|${sort}|${JSON.stringify(queryFilters)}`;
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollEl = container.querySelector("[data-slot=table-container]");
      if (scrollEl) scrollEl.scrollTop = 0;
    }
  }, [filterKey]);

  const tableData: EventTableRow[] = useMemo(
    () => sorted.map(({ properties: _, ...rest }) => rest),
    [sorted]
  );
  // `projectId` is undefined until ClientLayout resolves the instance → project
  // (a separate instances fetch + effect passes). While it's unresolved the
  // events/volume queries are disabled and report isLoading=false, so treat the
  // unresolved window as loading to show skeletons immediately on reload.
  const projectResolving = !projectId;
  const tableLoading =
    projectResolving ||
    eventsQuery.isLoading ||
    (eventsQuery.isFetching && !eventsQuery.isFetchingNextPage);
  const tableRefetching =
    eventsQuery.isFetching &&
    !eventsQuery.isLoading &&
    !eventsQuery.isFetchingNextPage &&
    tableData.length > 0;
  const graphLoading =
    projectResolving ||
    volumeQuery.isFetching ||
    (showGraph && tableRefetching);

  // IntersectionObserver for infinite scroll — fetches next cursor page
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          hasMore &&
          !eventsQuery.isFetchingNextPage
        ) {
          eventsQuery.fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, eventsQuery]);

  const volumeBins = useMemo(() => {
    if (!volumeQuery.data?.buckets) return [];
    return volumeQuery.data.buckets.map((b) => ({
      time: b.bucket,
      label: b.bucket,
      count: b.count,
    }));
  }, [volumeQuery.data]);

  const openVisitor = useCallback((id: string) => setVisitorOpen({ id }), []);
  const columns = useMemo(
    () => getEventsTableColumns(sort, setSort, addFilter, openVisitor),
    [sort, setSort, addFilter, openVisitor]
  );

  const handleRowClick = (row: EventTableRow) => {
    setSelectedEvent(sorted.find((e) => e.id === row.id) ?? null);
  };

  const hasFilters =
    searchTerm !== "" || platform !== "" || queryFilters.length > 0;

  const footerContent =
    sorted.length > 0 ? (
      <div ref={sentinelRef}>
        {hasMore || eventsQuery.isFetchingNextPage ? (
          <div>
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-2 py-2.5 border-t border-sidebar-border"
                style={{ opacity: 0.6 - i * 0.25 }}
              >
                {selectedColumns.map((col) => (
                  <Skeleton
                    key={col}
                    className={cn(
                      "h-4 rounded",
                      col === "timestamp"
                        ? "w-28"
                        : col === "event_name"
                          ? "w-24"
                          : col === "user_id" || col === "session_id"
                            ? "w-32"
                            : "w-16"
                    )}
                  />
                ))}
              </div>
            ))}
            <div className="flex items-center justify-end px-3 py-2.5 gap-2">
              <span className="text-xs text-muted-foreground animate-pulse">
                Loading more events
              </span>
              <div className="flex gap-1">
                <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-3">
            <span className="text-xs text-muted-foreground/60">
              End of results
            </span>
          </div>
        )}
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-3 p-6 h-full overflow-hidden">
      {/* Query bar + controls */}
      <div className="flex items-center gap-2">
        <QueryBar
          projectId={projectId}
          queryFilters={queryFilters}
          onAddFilter={addFilter}
          onRemoveFilter={removeFilter}
          onClearAll={clearAllFilters}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
        />
        <DateRangePicker
          date={dateRange}
          setDate={setDateRange}
          presets={EVENTS_DATE_PRESETS}
          defaultPresetLabel={isDefaultDateRange ? "Today" : undefined}
          withTime
          minDate={minDate}
          onUpgrade={
            retention && !isUnlimitedRetentionPlan(retention.plan)
              ? openScaleUp
              : undefined
          }
          footer={
            retention ? (
              <div className="pt-2 mt-1 border-t border-sidebar-border">
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {isUnlimitedRetentionPlan(retention.plan)
                    ? `${retention.queryable_days}-day history available.`
                    : `${retention.queryable_days}-day history on your ${retention.plan} plan.`}
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
        <Button
          variant={showGraph ? "secondary" : "outline"}
          size="sm"
          onClick={() =>
            setShowGraph((v) => {
              localStorage.setItem("events_show_graph", String(!v));
              return !v;
            })
          }
          aria-pressed={showGraph}
          className="shrink-0 gap-1.5"
        >
          <BarChart3 className="size-4" />
          Graph
        </Button>
        <CustomizeColumns
          columnOptions={COLUMN_OPTIONS}
          selectedColumns={selectedColumns}
          setSelectedColumns={setSelectedColumns}
        />
        {tableRefetching && (
          <div className="ml-auto hidden items-center gap-2 rounded-md border border-sidebar-border bg-background px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-sm @2xl/main:inline-flex">
            <Loader2 className="size-3 animate-spin" />
            Updating
          </div>
        )}
      </div>

      {/* Proactive cold/heavy caution */}
      {coldHeavyWarning && retention && (
        <AnalyticsNotice
          variant="warning"
          title="Filters can't search this far back"
          description={`Free-text search and “contains” / “is not” filters only run on data from the last ${retention.cold_after_days} days. Narrow the range or remove those filters to search older events.`}
        />
      )}

      {rangeOrderInvalid && (
        <AnalyticsNotice
          variant="warning"
          title="Date range is invalid"
          description="Choose a start date that is before the end date."
        />
      )}

      {!rangeOrderInvalid && rangeTooLarge && (
        <AnalyticsNotice
          variant="warning"
          title="Date range is too large"
          description={`Events can query at most ${VOLUME_MAX_DAYS} days at a time. Choose Last 3 months or a shorter custom range to load the table and timeline.`}
        />
      )}

      {/* Reactive backend limit error (retention / too-heavy) */}
      {!rangeOrderInvalid && !rangeTooLarge && eventsError && (
        <AnalyticsNotice
          variant="error"
          title={eventsError.title}
          description={eventsError.description}
          onUpgrade={
            eventsError.isRetention &&
            retention &&
            !isUnlimitedRetentionPlan(retention.plan)
              ? openScaleUp
              : undefined
          }
          onRetry={
            eventsError.isHeavy
              ? () => {
                  eventsQuery.refetch();
                  volumeQuery.refetch();
                }
              : undefined
          }
        />
      )}

      {/* Volume histogram */}
      {!rangeOrderInvalid && !rangeTooLarge && showGraph && (
        <EventVolumeChart
          data={volumeBins}
          hasFilters={hasFilters}
          loading={graphLoading}
          error={volumeError?.description ?? null}
          notice={`Times shown in ${VIEWER_TIMEZONE}`}
        />
      )}

      {/* Events table */}
      {rangeOrderInvalid ? (
        <div className="flex min-h-[220px] flex-1 items-center justify-center rounded-xl border border-sidebar-border bg-background px-4 text-center">
          <p className="max-w-md text-sm text-muted-foreground">
            Fix the date range to load events.
          </p>
        </div>
      ) : rangeTooLarge ? (
        <div className="flex min-h-[220px] flex-1 items-center justify-center rounded-xl border border-sidebar-border bg-background px-4 text-center">
          <p className="max-w-md text-sm text-muted-foreground">
            Select a date range up to {VOLUME_MAX_DAYS} days to load events.
          </p>
        </div>
      ) : !tableLoading && tableData.length === 0 && !hasFilters ? (
        <div className="rounded-xl border border-sidebar-border bg-background overflow-hidden">
          <AnalyticsEmptyState
            icon={Activity}
            title="No events recorded yet"
            description="Browse every event your app sends in real time — screen views, taps, purchases, and custom events. Integrate the Grovs SDK to start collecting data."
            sdkDescription="No events have been recorded in this time range. Events will appear here as users interact with your app."
            linkHref="/developers"
            linkLabel="Set up the SDK"
          />
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 flex-col" ref={scrollContainerRef}>
          <DataTable
            columns={columns}
            data={tableData}
            selectedColumns={selectedColumns}
            onRowClick={handleRowClick}
            getRowId={(row) => row.id}
            getRowAriaLabel={(row) => `${row.event_name} at ${row.timestamp}`}
            loading={tableLoading}
            hasFilters={hasFilters}
            ariaLabel="Events"
            stickyHeader
            skeletonCellClassName="px-2 py-2"
            containerClassName="rounded-md border border-sidebar-border overflow-hidden flex-1 min-h-0 [&>[data-slot=table-container]]:overflow-auto [&>[data-slot=table-container]]:h-full"
            footerContent={footerContent}
            emptyState={
              <AnalyticsEmptyState
                icon={Activity}
                title="No events recorded yet"
                description="Browse every event your app sends in real time — screen views, taps, purchases, and custom events. Integrate the Grovs SDK to start collecting data."
                sdkDescription="No events have been recorded in this time range. Events will appear here as users interact with your app."
                linkHref="/developers"
                linkLabel="Set up the SDK"
              />
            }
          />
        </div>
      )}

      <EventDetailSheet
        event={selectedEvent}
        projectId={projectId}
        onClose={() => setSelectedEvent(null)}
        onOpenVisitor={openVisitor}
      />

      <AudienceItemDetailsDialog
        open={visitorOpen}
        onOpenChange={(open) => !open && setVisitorOpen(null)}
      />

      {scaleUpDialog}
    </div>
  );
}
