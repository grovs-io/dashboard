import { differenceInCalendarDays, parseISO, sub } from "date-fns";
import { formatDateParam } from "@/lib/utils";
import type { QueryFilter } from "@/components/analytics/events/types";
import type {
  AnalyticsDateRangeParams,
  AnalyticsRetention,
  StoredFilter,
  WidgetSize,
} from "@/types";

export function sizeClass(size: WidgetSize): string {
  if (size === "md") return "@3xl/main:col-span-2";
  if (size === "lg") return "@3xl/main:col-span-3";
  return "";
}

/** What the page knows about its range, so each widget can gate on its own merged filters. */
export interface WidgetRangeLimits {
  rangeSpanDays: number;
  retention?: AnalyticsRetention;
  from?: Date;
  /** Start of the previous period; compare widgets scan back to here. */
  prevFrom?: Date;
}

/** Page chips first, then the widget's own, minus exact duplicates; the backend ANDs them. */
export function mergeFilterList(
  page: ReadonlyArray<QueryFilter | StoredFilter>,
  stored: ReadonlyArray<StoredFilter>
): StoredFilter[] {
  const seen = new Set<string>();
  const out: StoredFilter[] = [];
  for (const f of [...page, ...stored]) {
    const key = `${f.field}|${f.operator}|${JSON.stringify(f.value)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ field: f.field, operator: f.operator, value: f.value });
  }
  return out;
}

export function withMergedFilters(
  base: AnalyticsDateRangeParams,
  merged: ReadonlyArray<StoredFilter>
): AnalyticsDateRangeParams {
  const rest = { ...base };
  delete rest.filters;
  return merged.length ? { ...rest, filters: JSON.stringify(merged) } : rest;
}

/** The equal-length range just before `base`, same filters; undefined for an open range. */
export function previousRangeParams(
  base: AnalyticsDateRangeParams
): AnalyticsDateRangeParams | undefined {
  if (!base.start_date || !base.end_date) return undefined;
  const from = parseISO(base.start_date);
  const days = differenceInCalendarDays(parseISO(base.end_date), from) + 1;
  const prevTo = sub(from, { days: 1 });
  return {
    ...base,
    start_date: formatDateParam(sub(prevTo, { days: days - 1 })),
    end_date: formatDateParam(prevTo),
  };
}
