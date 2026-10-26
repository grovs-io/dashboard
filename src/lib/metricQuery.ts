import { countryName, formatPlatformName } from "@/lib/utils";
import { heavyShapeHitsCold, isHeavyQueryShape } from "@/lib/analyticsLimits";
import type { WidgetRangeLimits } from "@/components/dashboards/widgetLayout";
import type {
  AnalyticsDateRangeParams,
  AnalyticsRetention,
  MetricQuery,
  MetricQueryMetric,
  MetricQueryParams,
  MetricQueryRow,
} from "@/types";

export const OTHER_KEY = "__other__";
export const TOP_OPTIONS = [5, 10, 20, 50];

export const DIMENSIONS: { key: string; label: string }[] = [
  { key: "country", label: "Country" },
  { key: "platform", label: "Platform" },
  { key: "source", label: "Source" },
  { key: "campaign_id", label: "Campaign" },
  { key: "link_id", label: "Link" },
  { key: "app_version", label: "App version" },
  { key: "os", label: "OS" },
  { key: "os_version", label: "OS version" },
  { key: "device_model", label: "Device" },
  { key: "city", label: "City" },
  { key: "event_name", label: "Event name" },
  { key: "screen_name", label: "Screen" },
  { key: "tracking_source", label: "UTM source" },
  { key: "tracking_medium", label: "UTM medium" },
  { key: "tracking_campaign", label: "UTM campaign" },
  { key: "ads_platform", label: "Ads platform" },
  { key: "language", label: "Language" },
];

export const QUERY_METRICS: { key: MetricQueryMetric; label: string }[] = [
  { key: "events", label: "Events (all, incl. purchases)" },
  { key: "installs", label: "App installs" },
  { key: "unique_visitors", label: "Unique visitors" },
  { key: "views", label: "Views" },
  { key: "link_views", label: "Link views" },
  { key: "opens", label: "Opens" },
  { key: "link_driven_installs", label: "Link-driven installs" },
  { key: "reinstalls", label: "Reinstalls" },
  { key: "app_opens", label: "App opens" },
  { key: "referred_users", label: "Referred users" },
  { key: "unique_devices", label: "Unique devices" },
];

const QUERY_METRIC_KEYS = new Set<string>(QUERY_METRICS.map((m) => m.key));

export function toMetricQueryParams(
  base: AnalyticsDateRangeParams,
  q: MetricQuery
): MetricQueryParams {
  const p: MetricQueryParams = { ...base, metric: q.metric };
  if (q.group_by) p.group_by = q.group_by;
  if (q.granularity) p.granularity = q.granularity;
  if (q.limit) p.limit = q.limit;
  if (q.compare) p.compare = "true";
  return p;
}

export function bucketLabel(
  groupBy: string | null | undefined,
  row: MetricQueryRow
): string {
  if (row.key === "") return row.label || "(none)";
  if (groupBy === "country") return countryName(row.key) || row.label;
  if (groupBy === "platform") return formatPlatformName(row.key) || row.label;
  return row.label;
}

/** Cards without a counter fall back to installs. */
export function metricForCard(card: string): MetricQueryMetric {
  return QUERY_METRIC_KEYS.has(card) ? (card as MetricQueryMetric) : "installs";
}

/** Explorer chips name properties by bare key; `user.` and attributes pass through. */
export function filterFieldFor(groupBy: string): string {
  return groupBy.startsWith("properties.")
    ? groupBy.slice("properties.".length)
    : groupBy;
}

export type FilterLike = { field: string; operator: string; value: unknown };

const ROLLUP_DIMENSIONS = new Set<string | undefined>([
  undefined,
  "platform",
  "country",
  "app_version",
  "source",
  "properties.plan",
  "properties.tier",
]);
const RAW_ONLY_METRICS = new Set<MetricQueryMetric>([
  "events",
  "link_views",
  "link_driven_installs",
]);
/** Counter rollups carry no app_version/source columns. */
const UNTYPED_ROLLUP_DIMENSIONS = new Set(["app_version", "source"]);
const UNIQUE_METRICS = new Set<MetricQueryMetric>([
  "unique_visitors",
  "unique_devices",
]);
const DEFAULT_RAW_MAX_DAYS = 90;
const DEFAULT_RAW_COUNTER_MAX_DAYS = 366;

function isScalar(v: unknown): boolean {
  return v === null || (typeof v !== "object" && typeof v !== "function");
}

/** Mirrors Analytics::MetricQuery#rollup: true when the request must read raw events. */
export function isRawMetricQuery(
  q: MetricQuery,
  filters: ReadonlyArray<FilterLike>
): boolean {
  if (
    filters.some(
      (f) => f.field !== "platform" || f.operator !== "is" || !isScalar(f.value)
    )
  )
    return true;
  if (filters.filter((f) => f.field === "platform").length > 1) return true;
  const dim = q.group_by || undefined;
  if (RAW_ONLY_METRICS.has(q.metric)) return true;
  if (!ROLLUP_DIMENSIONS.has(dim)) return true;
  if (q.metric === "unique_devices" && dim !== undefined && dim !== "platform")
    return true;
  if (
    !UNIQUE_METRICS.has(q.metric) &&
    dim !== undefined &&
    UNTYPED_ROLLUP_DIMENSIONS.has(dim)
  )
    return true;
  return false;
}

/** Mirrors QueryController#raw_cap_days. */
export function metricQueryMaxDays(
  q: MetricQuery,
  filters: ReadonlyArray<FilterLike>,
  retention?: AnalyticsRetention
): number {
  return !UNIQUE_METRICS.has(q.metric) && !isHeavyQueryShape(undefined, filters)
    ? (retention?.raw_counter_max_days ?? DEFAULT_RAW_COUNTER_MAX_DAYS)
    : (retention?.raw_max_days ?? DEFAULT_RAW_MAX_DAYS);
}

/** undefined = the request may run; otherwise the notice to show instead of firing it. */
export function metricQueryBlockReason(
  q: MetricQuery,
  filters: ReadonlyArray<FilterLike>,
  limits: WidgetRangeLimits
): string | undefined {
  if (!isRawMetricQuery(q, filters)) return undefined;
  const cap = metricQueryMaxDays(q, filters, limits.retention);
  if (limits.rangeSpanDays > cap) {
    return `This query reads raw events and is limited to ${cap} days. Narrow the date range${filters.length ? " or remove filters" : ""}.`;
  }
  if (
    heavyShapeHitsCold(
      limits.retention,
      q.compare ? limits.prevFrom : limits.from,
      isHeavyQueryShape(undefined, filters),
      new Date()
    )
  ) {
    return "Some filters can't reach older data. “contains” and “is not” filters only run on recent data for your plan. Narrow the range or remove them.";
  }
  return undefined;
}
