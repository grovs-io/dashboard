"use client";

import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUrlState } from "@/hooks/useUrlState";
import { useAnalyticsEventFieldsQuery } from "@/hooks/queries/useAnalyticsEventsQueries";
import {
  DIMENSIONS,
  QUERY_METRICS,
  TOP_OPTIONS,
  filterFieldFor,
  metricForCard,
  metricQueryBlockReason,
  type FilterLike,
} from "@/lib/metricQuery";
import { WidgetFrame } from "@/components/analytics/widgets/WidgetFrame";
import { WidgetRenderer } from "@/components/analytics/widgets/WidgetRenderer";
import type {
  AnalyticsDateRangeParams,
  AnalyticsGranularity,
  MetricQuery,
  MetricQueryMetric,
} from "@/types";
import type { QueryFilter } from "@/components/analytics/events/types";
import type { WidgetRangeLimits } from "@/components/dashboards/widgetLayout";

export const DEFAULT_DIMENSION = "country";
const DEFAULT_TOP = 10;

export type BreakdownState = {
  metric?: MetricQueryMetric;
  timeline: boolean;
  compare: boolean;
  limit: number;
};

export function BreakdownPanel({
  projectId,
  base,
  filters,
  limits,
  cardMetric,
  granularity,
  onAddFilter,
  initial,
  onChange,
}: {
  projectId: string | undefined;
  base: AnalyticsDateRangeParams;
  /** The page chips already serialised into `base`; used only to judge whether the query can run. */
  filters: ReadonlyArray<FilterLike>;
  limits: WidgetRangeLimits;
  /** The overview's selected card; the breakdown follows it unless the user overrides the metric. */
  cardMetric: string;
  granularity: AnalyticsGranularity;
  onAddFilter: (
    field: string,
    value: string,
    operator: QueryFilter["operator"],
    displayValue?: string
  ) => void;
  /** Remembered metric override (for this card), timeline and compare state to seed on mount. */
  initial?: {
    metric?: MetricQueryMetric;
    timeline?: boolean;
    compare?: boolean;
    limit?: number;
  };
  /** Fired on every override/timeline/compare change so the page can remember it. */
  onChange?: (state: BreakdownState) => void;
}) {
  const [dimension, setDimension] = useUrlState("breakdown", DEFAULT_DIMENSION);
  const [override, setOverride] = useState<{
    card: string;
    metric: MetricQueryMetric;
  } | null>(
    initial?.metric ? { card: cardMetric, metric: initial.metric } : null
  );
  const [timeline, setTimeline] = useState(!!initial?.timeline);
  const [compare, setCompare] = useState(
    !!initial?.compare && !initial?.timeline
  );
  const [limit, setLimit] = useState(
    initial?.limit && TOP_OPTIONS.includes(initial.limit)
      ? initial.limit
      : DEFAULT_TOP
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const emitChange = (
    nextOverride: { card: string; metric: MetricQueryMetric } | null,
    nextTimeline: boolean,
    nextCompare: boolean,
    nextLimit: number = limit
  ) => {
    onChange?.({
      metric:
        nextOverride && nextOverride.card === cardMetric
          ? nextOverride.metric
          : undefined,
      timeline: nextTimeline,
      compare: nextCompare,
      limit: nextLimit,
    });
  };
  const changeLimit = (next: number) => {
    setLimit(next);
    emitChange(override, timeline, compare, next);
  };
  const nextTop = TOP_OPTIONS.find((n) => n > limit);

  // An override applies only to the card it was chosen for.
  const metric =
    override && override.card === cardMetric
      ? override.metric
      : metricForCard(cardMetric);

  // Property keys are discovered only once the picker opens, so the panel adds no request by default.
  const fieldsQuery = useAnalyticsEventFieldsQuery(projectId, pickerOpen);
  const propertyDimensions = useMemo(
    () =>
      (fieldsQuery.data?.fields ?? [])
        .filter((f) => f.type === "property")
        .map((f) => ({ key: `properties.${f.name}`, label: f.name })),
    [fieldsQuery.data]
  );

  const query = useMemo<MetricQuery>(
    () => ({
      metric,
      group_by: dimension,
      limit,
      ...(timeline ? { granularity } : {}),
      // Belt and braces: the switches are already mutually exclusive.
      ...(compare && !timeline ? { compare: true } : {}),
    }),
    [metric, dimension, limit, timeline, compare, granularity]
  );

  const blocked = metricQueryBlockReason(query, filters, limits);

  const isKnownDimension =
    DIMENSIONS.some((d) => d.key === dimension) ||
    propertyDimensions.some((d) => d.key === dimension);

  const dimensionLabel =
    DIMENSIONS.find((d) => d.key === dimension)?.label ??
    propertyDimensions.find((d) => d.key === dimension)?.label ??
    (dimension.startsWith("properties.")
      ? dimension.slice("properties.".length)
      : dimension);

  return (
    <WidgetFrame
      className="px-4 py-3.5"
      title="Breakdown"
      subtitle={`${QUERY_METRICS.find((m) => m.key === metric)?.label ?? metric} by ${dimensionLabel}. Click a row to filter.`}
      actions={
        <>
          <Select
            value={metric}
            onValueChange={(v) => {
              const next = { card: cardMetric, metric: v as MetricQueryMetric };
              setOverride(next);
              emitChange(next, timeline, compare);
            }}
          >
            <SelectTrigger
              className="h-8 w-[170px] text-xs"
              aria-label="Metric"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUERY_METRICS.map((m) => (
                <SelectItem key={m.key} value={m.key}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={dimension}
            onValueChange={setDimension}
            onOpenChange={setPickerOpen}
          >
            <SelectTrigger
              className="h-8 w-[150px] text-xs"
              aria-label="Dimension"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Attributes</SelectLabel>
                {DIMENSIONS.map((d) => (
                  <SelectItem key={d.key} value={d.key}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectGroup>
              {(propertyDimensions.length > 0 || !isKnownDimension) && (
                <SelectGroup>
                  <SelectLabel>Event properties</SelectLabel>
                  {propertyDimensions.map((d) => (
                    <SelectItem key={d.key} value={d.key}>
                      {d.label}
                    </SelectItem>
                  ))}
                  {!isKnownDimension && (
                    <SelectItem value={dimension}>{dimensionLabel}</SelectItem>
                  )}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          <Select
            value={String(limit)}
            onValueChange={(v) => changeLimit(Number(v))}
          >
            <SelectTrigger className="h-8 w-[96px] text-xs" aria-label="Top">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOP_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Top {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={timeline ? "line" : "bar"}
            onValueChange={(v) => {
              const nextTimeline = v === "line";
              const nextCompare = nextTimeline ? false : compare;
              setTimeline(nextTimeline);
              setCompare(nextCompare);
              emitChange(override, nextTimeline, nextCompare);
            }}
          >
            <SelectTrigger className="h-8 w-[120px] text-xs" aria-label="View">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bar">Bar list</SelectItem>
              <SelectItem value="line">Timeline</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={compare ? "previous" : "none"}
            disabled={timeline}
            onValueChange={(v) => {
              const nextCompare = v === "previous";
              setCompare(nextCompare);
              emitChange(override, timeline, nextCompare);
            }}
          >
            <SelectTrigger
              className="h-8 w-[170px] text-xs"
              aria-label="Compare"
              title={
                timeline
                  ? "Timelines already show change over time."
                  : undefined
              }
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No previous period</SelectItem>
              <SelectItem value="previous">Previous period</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
    >
      <WidgetRenderer
        projectId={projectId}
        base={base}
        query={query}
        viz={timeline ? "line" : "bar"}
        enabled={!blocked}
        compact
        onShowMore={nextTop ? () => changeLimit(nextTop) : undefined}
        onRowClick={(key, label) =>
          onAddFilter(filterFieldFor(dimension), key, "is", label)
        }
        emptyText={blocked ?? "No data for this selection"}
      />
    </WidgetFrame>
  );
}
