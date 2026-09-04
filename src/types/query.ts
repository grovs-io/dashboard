export interface DateRangeQuery {
  start_date: string;
  end_date?: string;
  platform?: string;
}

export interface PaginatedQuery extends DateRangeQuery {
  ascending: boolean;
  page: number;
  sort_by: string;
  per_page: number;
  term?: string;
}

export interface GetLinksParams {
  active: boolean;
  sdk: boolean;
  ascending: boolean;
  page: number;
  start_date: string;
  sort_by?: string;
  ads_platform?: string;
  term?: string;
  end_date?: string;
  event_type?: string;
  campaign_id?: string;
  per_page?: number;
  platform?: string;
}

export type GetVisitorsParams = PaginatedQuery;

export interface GetCampaignsParams {
  archived: boolean;
  ascending: boolean;
  page: number;
  start_date: string;
  sort_by: string;
  per_page: number;
  term?: string;
  end_date?: string;
}

export interface GetRevenueParams {
  ascending: boolean;
  current_page: number;
  start_date: string;
  sort_by: string;
  per_page: number;
  term?: string;
  end_date?: string;
  platform?: string;
}

export interface GetMessagingParams {
  page: number;
  for_new_users: boolean | null;
  archived: boolean;
  term?: string;
}

// ─── Analytics param types ────────────────────────────────────────

export interface AnalyticsDateRangeParams {
  start_date?: string;
  end_date?: string;
  platform?: string;
}

export interface AnalyticsEventsParams extends AnalyticsDateRangeParams {
  cursor?: string;
  limit?: number;
  search?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  filters?: string; // JSON-encoded EventFilter[]
  /** IANA zone the retention and range-cap guards judge the range in. */
  timezone?: string;
}

export interface AnalyticsEventVolumeParams extends AnalyticsDateRangeParams {
  bucket?: "hour" | "day" | "week";
  search?: string;
  filters?: string;
  /** IANA zone the buckets are cut in, e.g. "Europe/Bucharest". */
  timezone?: string;
}

export interface AnalyticsFieldValuesParams {
  field: string;
  q?: string;
  limit?: number;
  cursor?: string | number;
  start_date?: string;
  end_date?: string;
}

export interface AnalyticsOverviewParams extends AnalyticsDateRangeParams {
  search?: string;
  /** JSON-encoded filter array — unified filter contract shared with the Events explorer. */
  filters?: string;
}

export interface OverviewKeyMetricSeriesParams extends AnalyticsDateRangeParams {
  metric: string;
}

export interface AnalyticsRetentionSummaryParams {
  start_date?: string;
  end_date?: string;
  platform?: string;
  filters?: string;
}
