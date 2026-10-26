import type { MetricQuery } from "./metricQuery";

export type WidgetViz = "number" | "bar" | "line" | "table";
export type WidgetSize = "sm" | "md" | "lg";
export type WidgetKind = "metric" | "panel";
export type PanelKey =
  | "acquisition_channels"
  | "top_links"
  | "top_campaigns"
  | "acquisition"
  | "engagement"
  | "revenue"
  | "retention"
  | "user_trends"
  | "kpis_acquisition"
  | "kpis_engagement"
  | "kpis_revenue"
  | "kpis_links"
  | "revenue_trend";
/** Panel widgets store `query: {}`. */
export type EmptyQuery = Record<string, never>;

export interface StoredFilter {
  field: string;
  operator: "is" | "is_not" | "contains";
  value: string;
}

interface WidgetFields {
  title: string;
  /** Short line under the title; "{period}" follows the page granularity. Null = generated. */
  subtitle?: string | null;
  viz: WidgetViz;
  size: WidgetSize;
  filters: StoredFilter[];
}

export type WidgetPayload =
  | (WidgetFields & { kind: "metric"; panel: null; query: MetricQuery })
  | (WidgetFields & { kind: "panel"; panel: PanelKey; query: EmptyQuery });

export type DashboardWidget = WidgetPayload & {
  id: number;
  dashboard_id: number;
  position: number;
  created_at: string;
  updated_at: string;
};

export interface Dashboard {
  id: number;
  name: string;
  position: number;
  widgets: DashboardWidget[];
  created_at: string;
  updated_at: string;
}

export interface DashboardPayload {
  name: string;
}

export interface DashboardUpdatePayload {
  name?: string;
  widget_order?: number[];
}

/** All-time: when each SDK last reported, and whether any data exists yet. */
export interface SdkStatus {
  ios_seen_at: string | null;
  android_seen_at: string | null;
  web_seen_at: string | null;
  has_events: boolean;
  has_purchases: boolean;
  has_links: boolean;
}
