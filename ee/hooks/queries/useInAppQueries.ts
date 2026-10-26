"use client";
import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useInstanceConfigQuery } from "@/hooks/queries/useInstanceQueries";
import { useProjectSelection } from "@/context/useProjectSelection";
import { inAppPlatforms, type InAppPlatforms } from "@ee/lib/inApp";
import { inAppApi } from "@ee/api/in_app/inAppService";
import type { InAppStatus } from "@ee/types/inApp";

export function inAppCampaignQueryOptions(projectId: string, id: string) {
  return {
    queryKey: queryKeys.projects.inAppCampaign(projectId, id),
    queryFn: async ({ signal }: { signal?: AbortSignal }) =>
      (await inAppApi.get(projectId, id, signal)).data.in_app_campaign,
  };
}

export function useInAppCampaignsQuery(
  projectId: string,
  status: InAppStatus | "all",
  limit = 50
) {
  const apiStatus = status === "all" ? undefined : status;
  return useInfiniteQuery({
    queryKey: queryKeys.projects.inAppCampaigns(
      projectId,
      apiStatus ? { status: apiStatus } : undefined
    ),
    queryFn: async ({ pageParam, signal }) =>
      (
        await inAppApi.list(
          projectId,
          { status: apiStatus, after: pageParam, limit },
          signal
        )
      ).data,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_after ?? undefined,
    retry: false,
    // A campaign preparing its audience moves on by itself, so the list asks again until none is.
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) =>
        page.in_app_campaigns.some((c) => c.status === "preparing")
      )
        ? 5_000
        : false,
    refetchIntervalInBackground: false,
  });
}

// A preparing campaign is waiting for its audience, so it is asked about until it moves on.
export function useInAppCampaignQuery(
  projectId: string,
  id: string,
  enabled = true
) {
  return useQuery({
    ...inAppCampaignQueryOptions(projectId, id),
    enabled,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === "preparing" ? 3_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useInAppReportQuery(
  projectId: string,
  id: string,
  params: { from: string; to: string; by: "day" | "hour" },
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.projects.inAppReport(projectId, id, params),
    queryFn: async ({ signal }) =>
      (await inAppApi.report(projectId, id, params, signal)).data.report,
    enabled,
    retry: false,
  });
}

// Only asked when there is an experiment: the server answers 422 otherwise.
export function useInAppExperimentQuery(
  projectId: string,
  id: string,
  params: { from: string; to: string },
  enabled: boolean
) {
  return useQuery({
    queryKey: queryKeys.projects.inAppExperiment(projectId, id, params),
    queryFn: async ({ signal }) =>
      (
        await inAppApi.getExperiment(
          projectId,
          id,
          params.from,
          params.to,
          signal
        )
      ).data.experiment,
    enabled,
    retry: false,
  });
}

// A page at a time, newest first; another filter or period is another list.
export function useInAppCommentsQuery(
  projectId: string,
  id: string,
  params: { from: string; to: string; values?: string }
) {
  return useInfiniteQuery({
    queryKey: queryKeys.projects.inAppComments(projectId, id, params),
    queryFn: async ({ pageParam, signal }) =>
      (
        await inAppApi.comments(
          projectId,
          id,
          { ...params, before: pageParam },
          signal
        )
      ).data,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_before ?? undefined,
    retry: false,
  });
}

export function useInAppSettingsQuery(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.inAppSettings(projectId),
    queryFn: async ({ signal }) =>
      (await inAppApi.settings(projectId, signal)).data.in_app_settings,
    retry: false,
  });
}

// undefined while loading, null when the setup can't be read.
export function useInAppPlatforms(
  enabled = true
): InAppPlatforms | null | undefined {
  const { selectedInstance } = useProjectSelection();
  const { data, isError } = useInstanceConfigQuery(selectedInstance?.id, {
    enabled,
    refetchOnWindowFocus: "always",
  });
  return useMemo(() => {
    if (isError) return null;
    return data ? inAppPlatforms(data) : undefined;
  }, [data, isError]);
}
