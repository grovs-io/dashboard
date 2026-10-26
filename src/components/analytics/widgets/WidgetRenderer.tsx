"use client";

import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMetricQuery } from "@/hooks/queries/useMetricQuery";
import { toMetricQueryParams } from "@/lib/metricQuery";
import { getAnalyticsErrorInfo } from "@/lib/analyticsLimits";
import type {
  AnalyticsDateRangeParams,
  AnalyticsGranularity,
  MetricQuery,
  MetricQueryResponse,
} from "@/types";
import { NumberWidget } from "./NumberWidget";
import { BarListWidget } from "./BarListWidget";
import { LINE_SERIES, LineWidget } from "./LineWidget";
import { TableWidget } from "./TableWidget";
import type { RowClickHandler, WidgetViz } from "./types";

export function WidgetRenderer({
  projectId,
  base,
  query,
  viz,
  enabled = true,
  onRowClick,
  emptyText = "No data for this selection",
  compact = false,
  onShowMore,
  hideEmptyBucket = false,
}: {
  projectId: string | undefined;
  base: AnalyticsDateRangeParams;
  query: MetricQuery;
  viz: WidgetViz;
  enabled?: boolean;
  onRowClick?: RowClickHandler;
  emptyText?: string;
  /** Denser rows in two columns and a shorter chart, for the Overview breakdown. */
  compact?: boolean;
  /** When set, the Other row becomes a button that asks for more rows. */
  onShowMore?: () => void;
  /** Drops the "(none)" row (no value for the dimension) from grouped results. */
  hideEmptyBucket?: boolean;
}) {
  const params = useMemo(
    () =>
      toMetricQueryParams(
        base,
        viz === "line" ? { ...query, limit: LINE_SERIES } : query
      ),
    [base, query, viz]
  );
  const result = useMetricQuery(projectId, params, enabled);
  const { isLoading, error, isPlaceholderData } = result;
  const data = useMemo(
    () =>
      hideEmptyBucket && result.data
        ? withoutEmptyBucket(result.data)
        : result.data,
    [hideEmptyBucket, result.data]
  );
  if (!enabled)
    return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  if (error) {
    const info = getAnalyticsErrorInfo(error);
    return (
      <div className="rounded-md border border-dashed border-destructive/30 bg-destructive/5 px-3 py-2">
        <p className="text-xs font-medium text-destructive">{info.title}</p>
        <p className="text-[11px] text-muted-foreground">{info.description}</p>
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full rounded" />
        ))}
      </div>
    );
  }
  if (!Array.isArray(data.rows))
    return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  const body =
    viz === "number" ? (
      <NumberWidget data={data} />
    ) : data.rows.length === 0 ? (
      <p className="text-xs text-muted-foreground">{emptyText}</p>
    ) : viz === "line" ? (
      <LineWidget
        data={data}
        granularity={(query.granularity ?? "day") as AnalyticsGranularity}
        compact={compact}
      />
    ) : viz === "table" ? (
      <TableWidget
        data={data}
        onRowClick={isPlaceholderData ? undefined : onRowClick}
      />
    ) : (
      <BarListWidget
        data={data}
        onRowClick={isPlaceholderData ? undefined : onRowClick}
        compact={compact}
        onShowMore={isPlaceholderData ? undefined : onShowMore}
      />
    );
  // Dim the previous result while the new one loads.
  return isPlaceholderData ? (
    <div className="opacity-60 transition-opacity" aria-busy="true">
      {body}
    </div>
  ) : (
    body
  );
}

/** Removes the empty-key row and its count from the total, so shares stay among real values. */
export function withoutEmptyBucket(
  data: MetricQueryResponse
): MetricQueryResponse {
  if (!data.group_by || !Array.isArray(data.rows)) return data;
  const empty = data.rows.find((r) => r.key === "");
  if (!empty) return data;
  return {
    ...data,
    rows: data.rows.filter((r) => r !== empty),
    total: { ...data.total, value: data.total.value - empty.value },
  };
}
