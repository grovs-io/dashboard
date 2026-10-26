"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, GripVertical, MoreHorizontal } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WidgetFrame } from "@/components/analytics/widgets/WidgetFrame";
import { WidgetRenderer } from "@/components/analytics/widgets/WidgetRenderer";
import { metricQueryBlockReason } from "@/lib/metricQuery";
import { describeWidget } from "@/lib/widgetQueryModel";
import {
  rowsClickable,
  rowTarget,
  type RowTarget,
} from "@/lib/widgetRowTarget";
import type { QueryFilter } from "@/components/analytics/events/types";
import type {
  AnalyticsDateRangeParams,
  AnalyticsGranularity,
  DashboardWidget,
  MetricQuery,
} from "@/types";
import {
  mergeFilterList,
  sizeClass,
  withMergedFilters,
  type WidgetRangeLimits,
} from "./widgetLayout";
import { PanelWidget } from "./PanelWidget";
import { panelMeta } from "./panelCatalog";

const PERIOD: Record<AnalyticsGranularity, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
};

/** The stored subtitle, else a generated one; nothing when it would just repeat the title. */
export function cardSubtitle(
  widget: DashboardWidget,
  granularity: AnalyticsGranularity
): string | undefined {
  const text = widget.subtitle
    ? widget.subtitle.replace("{period}", PERIOD[granularity])
    : widgetSubtitle(widget);
  return text.trim().toLowerCase() === widget.title.trim().toLowerCase()
    ? undefined
    : text;
}

export function widgetSubtitle(widget: DashboardWidget): string {
  if (widget.kind === "panel") {
    const meta = panelMeta(widget.panel);
    return meta.filtersHonoured
      ? meta.label
      : `${meta.label} · date & platform only`;
  }
  return describeWidget(widget);
}

export function WidgetCard({
  widget,
  projectId,
  base,
  pageFilters,
  granularity,
  limits,
  revenueEnabled = false,
  onEdit,
  onDelete,
  onRowClick,
  sortable = true,
  readOnly = false,
  viewAllHref,
  className,
}: {
  widget: DashboardWidget;
  projectId: string | undefined;
  base: AnalyticsDateRangeParams;
  pageFilters: QueryFilter[];
  granularity: AnalyticsGranularity;
  limits: WidgetRangeLimits;
  revenueEnabled?: boolean;
  onEdit?: (widget: DashboardWidget) => void;
  onDelete?: (widget: DashboardWidget) => void;
  onRowClick?: (target: RowTarget) => void;
  sortable?: boolean;
  /** Built-in boards: no drag, no menu, and a KPI row drops its title. */
  readOnly?: boolean;
  /** Small "View all" link in the header. */
  viewAllHref?: string;
  /** Replaces the size's column span, for grids other than the board's. */
  className?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: !sortable || readOnly });

  // The widget's own chips are appended to the page's; a line widget follows the page granularity.
  const metricQuery = widget.kind === "panel" ? null : widget.query;
  const query = useMemo<MetricQuery | null>(
    () =>
      metricQuery && widget.viz === "line"
        ? { ...metricQuery, granularity }
        : metricQuery,
    [metricQuery, widget.viz, granularity]
  );
  const merged = useMemo(
    () => mergeFilterList(pageFilters, widget.filters),
    [pageFilters, widget.filters]
  );
  const widgetBase = useMemo(
    () => withMergedFilters(base, merged),
    [base, merged]
  );

  // Judged on this widget's own query and merged filters, like the backend does.
  const blockedText = query
    ? metricQueryBlockReason(query, merged, limits)
    : undefined;

  const groupBy = query?.group_by;
  const handleRow =
    onRowClick &&
    groupBy &&
    query &&
    rowsClickable({ groupBy, metric: query.metric })
      ? (key: string, label: string) => {
          const target = rowTarget({
            groupBy,
            key,
            label,
            metric: query.metric,
            base,
            filters: merged,
          });
          if (target) onRowClick(target);
        }
      : undefined;

  const body =
    widget.kind === "panel" ? (
      <PanelWidget
        projectId={projectId}
        panel={widget.panel}
        base={base}
        pageFilters={pageFilters}
        filters={widget.filters}
        limits={limits}
        revenueEnabled={revenueEnabled}
        granularity={granularity}
        onRowClick={onRowClick}
      />
    ) : (
      query && (
        <WidgetRenderer
          projectId={projectId}
          base={widgetBase}
          query={query}
          viz={widget.viz}
          enabled={!blockedText}
          emptyText={blockedText}
          onRowClick={handleRow}
          hideEmptyBucket
        />
      )
    );
  const bare = readOnly && widget.kind === "panel" && isKpiPanel(widget.panel);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex min-w-0 flex-col",
        className ?? sizeClass(widget.size),
        isDragging && "opacity-50"
      )}
    >
      {bare ? (
        <div className="flex-1 rounded-md border border-sidebar-border bg-muted/50 p-2 dark:bg-card">
          {body}
        </div>
      ) : (
        <WidgetFrame
          className="flex-1"
          title={widget.title}
          subtitle={cardSubtitle(widget, granularity)}
          actions={
            readOnly ? (
              viewAllHref && (
                <Link
                  href={viewAllHref}
                  className="inline-flex items-center gap-1 text-xs text-[var(--chart-users)] hover:text-[var(--chart-users-hover)]"
                >
                  View all <ArrowRight className="size-3" />
                </Link>
              )
            ) : (
              <>
                {sortable && (
                  <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    aria-label="Drag to reorder"
                    className="cursor-grab rounded-md p-1 text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
                  >
                    <GripVertical className="size-4" />
                  </button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label="Widget actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onEdit?.(widget)}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => onDelete?.(widget)}
                      className="text-destructive"
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )
          }
        >
          {body}
        </WidgetFrame>
      )}
    </div>
  );
}

function isKpiPanel(panel: string): boolean {
  return panel.startsWith("kpis_");
}
