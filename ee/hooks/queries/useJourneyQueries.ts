"use client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { journeysApi } from "@ee/api/journeys/journeysService";
import type { JourneyStatus } from "@ee/types/journey";

export function useJourneysQuery(
  projectId: string,
  status: JourneyStatus | "all",
  limit = 50
) {
  const apiStatus = status === "all" ? undefined : status;
  return useInfiniteQuery({
    queryKey: queryKeys.projects.journeys(
      projectId,
      apiStatus ? { status: apiStatus } : undefined
    ),
    queryFn: async ({ pageParam, signal }) =>
      (
        await journeysApi.list(
          projectId,
          { status: apiStatus, after: pageParam, limit },
          signal
        )
      ).data,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_after ?? undefined,
    retry: false,
  });
}

export function useJourneyQuery(projectId: string, id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.projects.journey(projectId, id),
    queryFn: async ({ signal }) =>
      (await journeysApi.get(projectId, id, signal)).data.journey,
    enabled,
    retry: false,
  });
}

export function useJourneyReportQuery(
  projectId: string,
  id: string,
  params: { from: string; to: string },
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.projects.journeyReport(projectId, id, params),
    queryFn: async ({ signal }) =>
      (await journeysApi.report(projectId, id, params, signal)).data.report,
    enabled,
    retry: false,
  });
}
