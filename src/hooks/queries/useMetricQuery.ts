import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { getMetricQueryAPICall } from "@/api/analytics/metricQueryService";
import type { MetricQueryParams, MetricQueryResponse } from "@/types";

export function useMetricQuery(
  projectId: string | undefined,
  params: MetricQueryParams | undefined,
  enabled = true
) {
  return useQuery<MetricQueryResponse>({
    queryKey: queryKeys.projects.analyticsMetricQuery(projectId!, params),
    queryFn: async () =>
      (await getMetricQueryAPICall(projectId!, params!)).data,
    enabled: enabled && !!projectId && !!params,
    placeholderData: keepPreviousData,
  });
}
