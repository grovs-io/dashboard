import type { AxiosResponse } from "axios";
import { GET } from "@/lib/api";
import { config } from "@/lib/config";
import { toQueryString } from "./utils";
import type {
  VersionsResponse,
  VersionDistributionResponse,
  VersionFunnelResponse,
  UserTrendsResponse,
  SourcesBreakdownResponse,
  OverviewKeyMetricsResponse,
  KeyMetricSeriesResponse,
  AnalyticsOverviewParams,
  AnalyticsDateRangeParams,
  OverviewKeyMetricSeriesParams,
} from "@/types";

const base = (projectId: string) =>
  config.apiPath + `/projects/${projectId}/analytics`;

export const getOverviewVersionsAPICall = async (
  projectId: string,
  params: AnalyticsOverviewParams = {}
): Promise<AxiosResponse<VersionsResponse>> => {
  return GET(`${base(projectId)}/overview/versions${toQueryString(params)}`);
};

export const getOverviewVersionDistributionAPICall = async (
  projectId: string,
  params: AnalyticsOverviewParams = {}
): Promise<AxiosResponse<VersionDistributionResponse>> => {
  return GET(
    `${base(projectId)}/overview/versions/distribution${toQueryString(params)}`
  );
};

export const getOverviewVersionFunnelAPICall = async (
  projectId: string,
  version: string,
  params: AnalyticsOverviewParams = {}
): Promise<AxiosResponse<VersionFunnelResponse>> => {
  return GET(
    `${base(projectId)}/overview/versions/${encodeURIComponent(version)}/funnel${toQueryString(params)}`
  );
};

export const getOverviewUserTrendsAPICall = async (
  projectId: string,
  params: AnalyticsOverviewParams = {}
): Promise<AxiosResponse<UserTrendsResponse>> => {
  return GET(
    `${base(projectId)}/overview/trends/users${toQueryString(params)}`
  );
};

export const getOverviewSourcesBreakdownAPICall = async (
  projectId: string,
  params: AnalyticsOverviewParams = {}
): Promise<AxiosResponse<SourcesBreakdownResponse>> => {
  return GET(
    `${base(projectId)}/overview/sources/breakdown${toQueryString(params)}`
  );
};

// Takes only start_date / end_date (YYYY-MM-DD) + optional platform.
export const getOverviewKeyMetricsAPICall = async (
  projectId: string,
  params: AnalyticsDateRangeParams = {}
): Promise<AxiosResponse<OverviewKeyMetricsResponse>> => {
  return GET(`${base(projectId)}/overview/key-metrics${toQueryString(params)}`);
};

// Daily, zero-filled series for a single chartable metric.
export const getOverviewKeyMetricSeriesAPICall = async (
  projectId: string,
  params: OverviewKeyMetricSeriesParams
): Promise<AxiosResponse<KeyMetricSeriesResponse>> => {
  return GET(
    `${base(projectId)}/overview/key-metrics/series${toQueryString(params)}`
  );
};
