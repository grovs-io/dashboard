import { parseISO } from "date-fns";
import { formatApiEndOfDay, formatApiStartOfDay } from "@/lib/dateUtils";
import type { TopListItem } from "@/components/analytics/overview/OverviewTopList";
import type {
  AnalyticsDateRangeParams,
  Campaign,
  DashboardLink,
  DateRangeQuery,
  GetCampaignsParams,
  MetricsOverview,
  MetricValues,
  OverviewKeyMetrics,
} from "@/types";

const TOP_N = 5;

export function topLinkItems(
  links: DashboardLink[] | undefined
): TopListItem[] {
  return [...(links ?? [])]
    .sort((a, b) => b.views - a.views)
    .slice(0, TOP_N)
    .map((l) => ({
      id: l.id,
      name: l.name,
      value: l.views,
      revenueCents: l.revenue_cents,
    }));
}

export function topCampaignItems(
  campaigns: Campaign[] | undefined
): TopListItem[] {
  return [...(campaigns ?? [])]
    .sort((a, b) => b.total_views - a.total_views)
    .slice(0, TOP_N)
    .map((c) => ({
      id: c.id,
      name: c.name,
      value: c.total_views,
      revenueCents: c.total_revenue,
    }));
}

export function buildTopLinksParams(
  from: Date,
  to: Date,
  platform?: string
): DateRangeQuery {
  return {
    start_date: formatApiStartOfDay(from),
    end_date: formatApiEndOfDay(to),
    ...(platform ? { platform } : {}),
  };
}

export function buildTopCampaignsParams(
  from: Date,
  to: Date | undefined,
  platform?: string
): GetCampaignsParams {
  return {
    archived: false,
    ascending: false,
    page: 1,
    per_page: TOP_N,
    sort_by: "views",
    start_date: formatApiStartOfDay(from),
    ...(to ? { end_date: formatApiEndOfDay(to) } : {}),
    ...(platform ? { platform } : {}),
  };
}

// parseISO reads "yyyy-MM-dd" as local midnight, matching formatDateParam.
export function topLinksParams(
  base: AnalyticsDateRangeParams
): DateRangeQuery | null {
  if (!base.start_date || !base.end_date) return null;
  return buildTopLinksParams(
    parseISO(base.start_date),
    parseISO(base.end_date),
    base.platform
  );
}

export function topCampaignsParams(
  base: AnalyticsDateRangeParams
): GetCampaignsParams | null {
  if (!base.start_date) return null;
  return buildTopCampaignsParams(
    parseISO(base.start_date),
    base.end_date ? parseISO(base.end_date) : undefined,
    base.platform
  );
}

/** Legacy MetricsOverview shape from key-metrics; CH names organic installs `organic_installs`. */
export function toMetricsOverview(
  cur: OverviewKeyMetrics | undefined,
  prev?: OverviewKeyMetrics
): MetricsOverview | undefined {
  if (!cur) return undefined;
  const toValues = (m: OverviewKeyMetrics): MetricValues => ({
    ...m,
    organic_users: m.organic_installs,
  });
  return { current: toValues(cur), previous: toValues(prev ?? cur) };
}
