"use client";

import { useMemo } from "react";
import { differenceInCalendarDays, sub } from "date-fns";
import type { DateRange } from "react-day-picker";
import type { QueryFilter } from "@/components/analytics/events/types";
import type {
  AnalyticsDateRangeParams,
  AnalyticsGranularity,
  AnalyticsOverviewParams,
  DateRangeQuery,
  GetCampaignsParams,
} from "@/types";
import { formatDateParam } from "@/lib/utils";
import { buildTopCampaignsParams, buildTopLinksParams } from "@/lib/topLists";
import { platformFromQueryFilters } from "@/hooks/useTableParams";

export interface OverviewQueryParams {
  platform: string;
  filtersJson?: string;
  /** True when any chip other than a single `platform is X` is active. */
  hasNonPlatformFilters: boolean;
  /** key-metrics / series: date + platform + filters. Retention takes only date + platform. */
  base: AnalyticsDateRangeParams;
  /** Previous equal-length range; undefined when the range is open. */
  prev?: AnalyticsDateRangeParams;
  trends: AnalyticsOverviewParams;
  /** Legacy POST endpoints (top links): date-times + platform only. */
  metrics: DateRangeQuery | null;
  campaigns: GetCampaignsParams | null;
}

export function buildOverviewQueryParams(
  dateRange: DateRange | undefined,
  queryFilters: QueryFilter[],
  granularity: AnalyticsGranularity
): OverviewQueryParams {
  const platform = platformFromQueryFilters(queryFilters);
  const platformChips = queryFilters.filter((f) => f.field === "platform");
  const hasNonPlatformFilters =
    queryFilters.some((f) => f.field !== "platform" || f.operator !== "is") ||
    platformChips.length > 1;
  const filtersJson = queryFilters.length
    ? JSON.stringify(
        queryFilters.map((f) => ({
          field: f.field,
          operator: f.operator,
          value: f.value,
        }))
      )
    : undefined;

  const withCommon = (
    p: AnalyticsDateRangeParams
  ): AnalyticsDateRangeParams => {
    if (platform) p.platform = platform;
    if (filtersJson) p.filters = filtersJson;
    return p;
  };

  const base = withCommon({});
  if (dateRange?.from) base.start_date = formatDateParam(dateRange.from);
  if (dateRange?.to) base.end_date = formatDateParam(dateRange.to);

  let prev: AnalyticsDateRangeParams | undefined;
  if (dateRange?.from && dateRange?.to) {
    const days = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
    const prevTo = sub(dateRange.from, { days: 1 });
    const prevFrom = sub(prevTo, { days: days - 1 });
    prev = withCommon({
      start_date: formatDateParam(prevFrom),
      end_date: formatDateParam(prevTo),
    });
  }

  const trends: AnalyticsOverviewParams = { ...base, granularity };

  const metrics: DateRangeQuery | null =
    dateRange?.from && dateRange?.to
      ? buildTopLinksParams(dateRange.from, dateRange.to, platform)
      : null;
  const campaigns: GetCampaignsParams | null = dateRange?.from
    ? buildTopCampaignsParams(dateRange.from, dateRange.to, platform)
    : null;

  return {
    platform,
    filtersJson,
    hasNonPlatformFilters,
    base,
    prev,
    trends,
    metrics,
    campaigns,
  };
}

export function useOverviewQueryParams(
  dateRange: DateRange | undefined,
  queryFilters: QueryFilter[],
  granularity: AnalyticsGranularity
): OverviewQueryParams {
  return useMemo(
    () => buildOverviewQueryParams(dateRange, queryFilters, granularity),
    [dateRange, queryFilters, granularity]
  );
}
