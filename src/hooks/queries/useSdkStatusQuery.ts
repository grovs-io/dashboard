import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { getSdkStatusAPICall } from "@/api/sdkStatus/sdkStatusService";
import { needsSetup, type SetupKind } from "@/lib/sdkStatus";
import type { SdkStatus } from "@/types";

/**
 * Re-checks every 30s while `kind`'s setup panel waits for data, or every
 * `refetchInterval` ms when given. Errors leave `data` undefined.
 */
export function useSdkStatusQuery(
  projectId: string | undefined,
  kind: SetupKind | null = null,
  { refetchInterval }: { refetchInterval?: number | false } = {}
) {
  return useQuery<SdkStatus>({
    queryKey: queryKeys.projects.sdkStatus(projectId!),
    queryFn: async () => (await getSdkStatusAPICall(projectId!)).data,
    enabled: !!projectId,
    staleTime: 60_000,
    retry: false,
    refetchInterval: (query) =>
      refetchInterval !== undefined
        ? refetchInterval
        : kind && needsSetup(kind, query.state.data)
          ? 30_000
          : false,
  });
}
