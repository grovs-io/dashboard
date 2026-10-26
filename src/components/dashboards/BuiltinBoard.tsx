"use client";

import type { QueryFilter } from "@/components/analytics/events/types";
import type { RowTarget } from "@/lib/widgetRowTarget";
import type { AnalyticsDateRangeParams, AnalyticsGranularity } from "@/types";
import { WidgetCard } from "./WidgetCard";
import { builtinSpanClass, type BuiltinDashboard } from "./builtinDashboards";
import type { WidgetRangeLimits } from "./widgetLayout";

/** A built-in dashboard: its in-code widgets, read-only. */
export function BuiltinBoard({
  dashboard,
  projectId,
  base,
  pageFilters,
  granularity,
  limits,
  onRowClick,
}: {
  dashboard: BuiltinDashboard;
  projectId: string | undefined;
  base: AnalyticsDateRangeParams;
  pageFilters: QueryFilter[];
  granularity: AnalyticsGranularity;
  limits: WidgetRangeLimits;
  onRowClick?: (target: RowTarget) => void;
}) {
  return (
    <section
      aria-label={dashboard.name}
      className="grid grid-cols-1 gap-4 @3xl/main:grid-cols-6"
    >
      {dashboard.widgets.map((w) => (
        <WidgetCard
          key={w.id}
          widget={w}
          projectId={projectId}
          base={base}
          pageFilters={pageFilters}
          granularity={granularity}
          limits={limits}
          revenueEnabled
          readOnly
          className={builtinSpanClass(w)}
          viewAllHref={w.viewAll}
          onRowClick={onRowClick}
        />
      ))}
    </section>
  );
}
