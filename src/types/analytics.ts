// ─── Events ───────────────────────────────────────────────────────

export interface AnalyticsEvent {
  event_id: string;
  project_id: number;
  event_type: string;
  event_name: string;
  screen_name: string;
  created_at: string;
  platform: string;
  device_model: string;
  device_id: number;
  os: string;
  os_version: string;
  app_version: string;
  country: string;
  city: string;
  visitor_id: number;
  session_id: string;
  engagement_time: number;
  link_id: number;
  campaign_id: number;
  tracking_source: string;
  tracking_medium: string;
  tracking_campaign: string;
  ads_platform: string;
  sdk_identifier: string;
  /** Detail endpoint only — Audience uuid of this event's visitor (null = no resolvable visitor). */
  visitor_uuid?: string | null;
  /** Detail endpoint only — visitor id guaranteed valid for GET /visitors/{id};
   *  prefer over visitor_id for merged visitors. */
  resolved_visitor_id?: number | null;
  properties: Record<string, unknown>;
}

export interface EventsListResponse {
  data: AnalyticsEvent[];
  next_cursor: string | null;
  total_count: number | null;
}

export interface EventDetailResponse {
  data: AnalyticsEvent;
}

export interface EventVolumeBucket {
  /** Pre-formatted wall-clock label in the requested timezone — never parse this. */
  bucket: string;
  count: number;
}

export interface EventVolumeResponse {
  buckets: EventVolumeBucket[];
}

export interface EventField {
  name: string;
  type: string;
}

export interface EventFieldsResponse {
  fields: EventField[];
}

export interface EventFieldValuesResponse {
  values: (string | { id: number | string; name: string })[];
  next_cursor?: string | number | null;
}

export interface EventFilter {
  field: string;
  operator: string;
  value: string;
}

// ─── Overview ─────────────────────────────────────────────────────

export interface VersionEntry {
  version: string;
  users: number;
}

export interface VersionsResponse {
  platforms: Record<string, VersionEntry[]>;
}

export interface VersionDistributionEntry {
  version: string;
  release_date: string | null;
  platforms: Record<string, number>;
  total: number;
}

export interface VersionDistributionResponse {
  entries: VersionDistributionEntry[];
}

export interface FunnelStep {
  label: string;
  users: number;
  rate: number;
}

export interface VersionFunnelResponse {
  version: string;
  release_date: string | null;
  funnels: Record<string, FunnelStep[]>;
}

export interface TrendPoint {
  date: string;
  /**
   * Bucketed by first-activity date and qualified by an install anywhere in the
   * selected range. Recent buckets can increase when a visitor installs later.
   */
  new_users: number;
  previous_new_users: number;
  /** Temporary compatibility with backend images predating explicit field names. */
  users?: number;
  previous_users?: number;
  /** Per-day revenue in cents — drives the chart's revenue trend line when present. */
  revenue_usd_cents?: number;
}

export interface UserTrendsResponse {
  points: TrendPoint[];
}

export interface SourceEntry {
  name: string;
  value: number;
}

export interface SourcesBreakdownResponse {
  sources: SourceEntry[];
  total: number;
}

// ─── Overview key metrics ─────────────────────────────────────────

/** All keys always present; integers except `returning_rate`/`arpu`/`arppu` (floats). */
export interface OverviewKeyMetrics {
  views: number;
  link_views: number;
  opens: number;
  installs: number;
  link_driven_installs: number;
  organic_installs: number;
  reinstalls: number;
  app_opens: number;
  total_users: number;
  new_users: number;
  returning_users: number;
  returning_rate: number;
  referred_users: number;
  revenue: number;
  units_sold: number;
  cancellations: number;
  first_time_purchases: number;
  arpu: number;
  arppu: number;
}

export interface OverviewKeyMetricsResponse {
  metrics: OverviewKeyMetrics;
}

/** Count metrics chartable via /key-metrics/series (user-classification metrics
 *  — total/new/returning users — are NOT; use /overview/trends/users). */
export type ChartableKeyMetric =
  | "views"
  | "link_views"
  | "opens"
  | "installs"
  | "link_driven_installs"
  | "organic_installs"
  | "reinstalls"
  | "app_opens"
  | "referred_users";

export interface KeyMetricSeriesPoint {
  date: string;
  value: number;
}

export interface KeyMetricSeriesResponse {
  metric: string;
  points: KeyMetricSeriesPoint[];
}

// ─── Retention ────────────────────────────────────────────────────

export interface SparklinePoint {
  value: number;
}

export interface RetentionSummaryResponse {
  day_1: number | null;
  day_7: number | null;
  day_30: number | null;
  sparkline: { day: number; rate: number }[];
  median_churn_day: number | null;
}
