"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { endOfDay, startOfDay } from "date-fns";
import { Loader2, RefreshCw, ScrollText, Search, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import DataTable from "@/components/common/DataTable";
import CustomizeColumns from "@/components/common/customize-columns";
import {
  DateRangePicker,
  type Preset,
} from "@/components/dateRangePicker/DateRangePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsEmptyState } from "@/components/analytics/AnalyticsEmptyState";
import {
  useAuditHeadQuery,
  useAuditEventsInfiniteQuery,
} from "@/hooks/queries/useAuditQueries";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { queryKeys } from "@/lib/queryKeys";
import { ApiError } from "@/lib/ApiError";
import { showGenericError } from "@/lib/Notifications";
import { cn } from "@/lib/utils";
import type { AuditEvent, AuditEventFilters } from "@/types";
import AuditActionCombobox from "./AuditActionCombobox";
import AuditEventDetailSheet from "./AuditEventDetailSheet";
import {
  getAuditTableColumns,
  COLUMN_OPTIONS,
  DEFAULT_VISIBLE_COLUMNS,
  type AuditTableRow,
} from "./AuditTableColumns";

const ALL_TIME_LABEL = "All time";

const DATE_PRESETS: Preset[] = [
  // An empty range clears the from/to filters — the log is unbounded by default.
  { label: ALL_TIME_LABEL, range: () => ({ from: undefined, to: undefined }) },
  { label: "Last 7 days", value: 7, duration: "days" },
  { label: "Last 30 days", value: 30, duration: "days" },
  { label: "Last 3 months", value: 3, duration: "months" },
];

function targetLabel(target: Record<string, unknown>): string {
  const type = target.type ? String(target.type) : "";
  const id = target.id != null ? `#${String(target.id)}` : "";
  const email = target.email ? String(target.email) : "";
  return [type ? `${type}${id ? ` ${id}` : ""}` : "", email]
    .filter(Boolean)
    .join(" · ");
}

export default function AuditLogExplorer({
  instanceId,
}: {
  instanceId: string;
}) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    DEFAULT_VISIBLE_COLUMNS
  );
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const debouncedActorEmail = useDebouncedValue(actorEmail.trim(), 300);

  const filters = useMemo<AuditEventFilters>(
    () => ({
      event_action: action,
      actor_email: debouncedActorEmail,
      from: dateRange?.from ? startOfDay(dateRange.from).toISOString() : "",
      to: dateRange?.from
        ? endOfDay(dateRange.to ?? dateRange.from).toISOString()
        : "",
    }),
    [action, debouncedActorEmail, dateRange]
  );
  const hasFilters = Object.values(filters).some((v) => v !== "");

  const headQuery = useAuditHeadQuery(instanceId, true);
  const eventsQuery = useAuditEventsInfiniteQuery(instanceId, filters, true);

  const events = useMemo(
    () => eventsQuery.data?.pages.flatMap((p) => p.events) ?? [],
    [eventsQuery.data]
  );

  const tableData = useMemo<AuditTableRow[]>(
    () =>
      events.map((e) => ({
        id: String(e.sequence),
        sequence: e.sequence,
        timestamp: e.occurred_at,
        action: e.action,
        actor: e.actor.email || e.actor.type,
        actorType: e.actor.type,
        target: targetLabel(e.target),
        outcome: e.outcome,
        ip: e.ip ?? "",
      })),
    [events]
  );

  const forbidden =
    eventsQuery.error instanceof ApiError && eventsQuery.error.status === 403;

  useEffect(() => {
    if (eventsQuery.error && !forbidden) showGenericError();
  }, [eventsQuery.error, forbidden]);

  // Filters changed → back to the top of the list.
  const filterKey = `${action}|${debouncedActorEmail}|${dateRange?.from?.getTime()}|${dateRange?.to?.getTime()}`;
  useEffect(() => {
    const container = scrollContainerRef.current;
    const scrollEl = container?.querySelector("[data-slot=table-container]");
    if (scrollEl) scrollEl.scrollTop = 0;
  }, [filterKey]);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = eventsQuery;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.instances.auditHead(instanceId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.instances.auditEventsAll(instanceId),
    });
  };

  const columns = useMemo(() => getAuditTableColumns(), []);

  const tableLoading = eventsQuery.isLoading;
  const tableRefetching =
    eventsQuery.isFetching &&
    !eventsQuery.isLoading &&
    !isFetchingNextPage &&
    tableData.length > 0;

  const footerContent =
    tableData.length > 0 ? (
      <div ref={sentinelRef}>
        {hasNextPage || isFetchingNextPage ? (
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
                        : col === "action"
                          ? "w-40"
                          : col === "actor" || col === "target"
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

  if (forbidden) {
    return (
      <div className="flex flex-col gap-3 p-6 h-full">
        <div className="rounded-xl border border-sidebar-border px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            You don&apos;t have access to the audit log for this project.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-6 h-full overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            className="h-8 pl-8 pr-8 text-xs"
            placeholder="Filter by actor email…"
            aria-label="Filter by actor email"
            value={actorEmail}
            onChange={(e) => setActorEmail(e.target.value)}
          />
          {actorEmail && (
            <button
              type="button"
              aria-label="Clear actor email"
              onClick={() => setActorEmail("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <AuditActionCombobox value={action} onChange={setAction} />

        <div className="ml-auto flex items-center gap-2">
          {tableRefetching && (
            <div className="hidden items-center gap-2 rounded-md border border-sidebar-border bg-background px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-sm @2xl/main:inline-flex">
              <Loader2 className="size-3 animate-spin" />
              Updating
            </div>
          )}
          {headQuery.data && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {headQuery.data.sequence} events
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            aria-label="Refresh audit log"
            className="shrink-0"
          >
            <RefreshCw className="size-3.5" />
          </Button>

          <DateRangePicker
            date={dateRange}
            setDate={setDateRange}
            presets={DATE_PRESETS}
            defaultPresetLabel={ALL_TIME_LABEL}
          />

          <CustomizeColumns
            columnOptions={COLUMN_OPTIONS}
            selectedColumns={selectedColumns}
            setSelectedColumns={setSelectedColumns}
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex flex-1 min-h-0 flex-col" ref={scrollContainerRef}>
        <DataTable
          columns={columns}
          data={tableData}
          selectedColumns={selectedColumns}
          onRowClick={(row) =>
            setSelectedEvent(
              events.find((e) => String(e.sequence) === row.id) ?? null
            )
          }
          getRowId={(row) => row.id}
          getRowAriaLabel={(row) => `${row.action} at ${row.timestamp}`}
          loading={tableLoading}
          hasFilters={hasFilters}
          ariaLabel="Audit log"
          stickyHeader
          skeletonCellClassName="px-2 py-2"
          containerClassName="rounded-md border border-sidebar-border overflow-hidden flex-1 min-h-0 [&>[data-slot=table-container]]:overflow-auto [&>[data-slot=table-container]]:h-full"
          footerContent={footerContent}
          emptyState={
            <AnalyticsEmptyState
              icon={ScrollText}
              title="No audit events yet"
              description="Every security-relevant action on this project is recorded here — tamper-evident and append-only."
              sdkDescription="No audit events match these filters."
            />
          }
        />
      </div>

      <AuditEventDetailSheet
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
