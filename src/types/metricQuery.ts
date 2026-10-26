import type { AnalyticsDateRangeParams, AnalyticsGranularity } from "./query";

export type MetricQueryMetric =
  | "events"
  | "views"
  | "link_views"
  | "opens"
  | "installs"
  | "link_driven_installs"
  | "reinstalls"
  | "app_opens"
  | "referred_users"
  | "unique_visitors"
  | "unique_devices";

/** Stored as a widget's query, so it must stay JSON-serialisable. */
export interface MetricQuery {
  metric: MetricQueryMetric;
  group_by?: string;
  granularity?: AnalyticsGranularity;
  limit?: number;
  compare?: boolean;
}

export interface MetricQueryParams extends AnalyticsDateRangeParams {
  metric: MetricQueryMetric;
  group_by?: string;
  granularity?: AnalyticsGranularity;
  limit?: number;
  compare?: "true";
}

export interface MetricQueryPoint {
  date: string;
  value: number;
}

export interface MetricQueryRow {
  key: string;
  label: string;
  value: number;
  previous?: number | null;
  points?: MetricQueryPoint[] | null;
}

export interface MetricQueryResponse {
  metric: string;
  group_by: string | null;
  rows: MetricQueryRow[];
  other: MetricQueryRow | null;
  total: { value: number; previous?: number | null };
}
