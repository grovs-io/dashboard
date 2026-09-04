import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { getRetentionSummaryAPICall } from "@/api/analytics/analyticsRetentionService";
import type {
  RetentionSummaryResponse,
  AnalyticsRetentionSummaryParams,
} from "@/types";

export function useRetentionSummaryQuery(
  projectId: string | undefined,
  params?: AnalyticsRetentionSummaryParams
) {
  return useQuery<RetentionSummaryResponse>({
    queryKey: queryKeys.projects.analyticsRetentionSummary(projectId!, params),
    queryFn: async () => {
      const response = await getRetentionSummaryAPICall(projectId!, params);
      return response.data;
    },
    enabled: !!projectId,
  });
}
