import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  getOverviewVersionsAPICall,
  getOverviewVersionDistributionAPICall,
  getOverviewVersionFunnelAPICall,
  getOverviewUserTrendsAPICall,
  getOverviewSourcesBreakdownAPICall,
  getOverviewKeyMetricsAPICall,
  getOverviewKeyMetricSeriesAPICall,
} from "@/api/analytics/analyticsOverviewService";
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

export function useOverviewVersionsQuery(
  projectId: string | undefined,
  params?: AnalyticsOverviewParams
) {
  return useQuery<VersionsResponse>({
    queryKey: queryKeys.projects.analyticsOverviewVersions(projectId!, params),
    queryFn: async () => {
      const response = await getOverviewVersionsAPICall(projectId!, params);
      return response.data;
    },
    enabled: !!projectId,
  });
}

export function useOverviewVersionDistributionQuery(
  projectId: string | undefined,
  params?: AnalyticsOverviewParams
) {
  return useQuery<VersionDistributionResponse>({
    queryKey: queryKeys.projects.analyticsOverviewVersionDistribution(
      projectId!,
      params
    ),
    queryFn: async () => {
      const response = await getOverviewVersionDistributionAPICall(
        projectId!,
        params
      );
      return response.data;
    },
    enabled: !!projectId,
  });
}

export function useOverviewVersionFunnelQuery(
  projectId: string | undefined,
  version: string | undefined,
  params?: AnalyticsOverviewParams
) {
  return useQuery<VersionFunnelResponse>({
    queryKey: queryKeys.projects.analyticsOverviewVersionFunnel(
      projectId!,
      version!,
      params
    ),
    queryFn: async () => {
      const response = await getOverviewVersionFunnelAPICall(
        projectId!,
        version!,
        params
      );
      return response.data;
    },
    enabled: !!projectId && !!version,
  });
}

export function useOverviewUserTrendsQuery(
  projectId: string | undefined,
  params?: AnalyticsOverviewParams
) {
  return useQuery<UserTrendsResponse>({
    queryKey: queryKeys.projects.analyticsOverviewUserTrends(
      projectId!,
      params
    ),
    queryFn: async () => {
      const response = await getOverviewUserTrendsAPICall(projectId!, params);
      return response.data;
    },
    enabled: !!projectId,
  });
}

export function useOverviewKeyMetricsQuery(
  projectId: string | undefined,
  params?: AnalyticsDateRangeParams,
  enabled = true
) {
  return useQuery<OverviewKeyMetricsResponse>({
    queryKey: queryKeys.projects.analyticsOverviewKeyMetrics(
      projectId!,
      params
    ),
    queryFn: async () => {
      const response = await getOverviewKeyMetricsAPICall(projectId!, params);
      return response.data;
    },
    enabled: enabled && !!projectId,
    placeholderData: keepPreviousData,
  });
}

export function useOverviewKeyMetricSeriesQuery(
  projectId: string | undefined,
  params: OverviewKeyMetricSeriesParams | undefined
) {
  return useQuery<KeyMetricSeriesResponse>({
    queryKey: queryKeys.projects.analyticsOverviewKeyMetricSeries(
      projectId!,
      params
    ),
    queryFn: async () => {
      const response = await getOverviewKeyMetricSeriesAPICall(
        projectId!,
        params!
      );
      return response.data;
    },
    enabled: !!projectId && !!params?.metric,
    placeholderData: keepPreviousData,
  });
}

export function useOverviewSourcesBreakdownQuery(
  projectId: string | undefined,
  params?: AnalyticsOverviewParams
) {
  return useQuery<SourcesBreakdownResponse>({
    queryKey: queryKeys.projects.analyticsOverviewSourcesBreakdown(
      projectId!,
      params
    ),
    queryFn: async () => {
      const response = await getOverviewSourcesBreakdownAPICall(
        projectId!,
        params
      );
      return response.data;
    },
    enabled: !!projectId,
  });
}
