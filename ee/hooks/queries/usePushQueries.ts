"use client";
import { useEffect, useMemo, useRef } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { ApiError } from "@/lib/ApiError";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useInstanceConfigQuery } from "@/hooks/queries/useInstanceQueries";
import { useProjectSelection } from "@/context/useProjectSelection";
import { awaitingWinner, pushChannels, type PushChannels } from "@ee/lib/push";
import { pushApi } from "@ee/api/push/pushCampaignsService";
import type {
  PushAudienceInput,
  PushCampaign,
  PushDeliveryStatus,
  PushEstimate,
  PushStatus,
} from "@ee/types/push";

const POLLING_STATUSES = new Set(["evaluating", "sending"]);
const isPolling = (campaign: PushCampaign | undefined) =>
  POLLING_STATUSES.has(campaign?.status ?? "");
// A campaign whose rest wait for a winner moves on by itself when the timer fires.
const pollEvery = (campaign: PushCampaign | undefined) =>
  isPolling(campaign)
    ? 3_000
    : campaign && awaitingWinner(campaign)
      ? 30_000
      : false;

export function pushCampaignQueryOptions(projectId: string, id: string) {
  return {
    queryKey: queryKeys.projects.pushCampaign(projectId, id),
    queryFn: async ({ signal }: { signal?: AbortSignal }) =>
      (await pushApi.get(projectId, id, signal)).data.push_campaign,
  };
}

export function usePushCampaignsQuery(
  projectId: string,
  status: PushStatus | "all",
  limit = 50
) {
  const apiStatus = status === "all" ? undefined : status;
  return useInfiniteQuery({
    queryKey: queryKeys.projects.pushCampaigns(
      projectId,
      apiStatus ? { status: apiStatus } : undefined
    ),
    queryFn: async ({ pageParam, signal }) =>
      (
        await pushApi.list(
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

export function usePushCampaignQuery(
  projectId: string,
  id: string,
  enabled = true
) {
  return useQuery({
    ...pushCampaignQueryOptions(projectId, id),
    enabled,
    retry: false,
    refetchInterval: (query) => pollEvery(query.state.data),
    refetchIntervalInBackground: false,
  });
}

// Only asked when there is an experiment: the server answers 422 otherwise.
export function usePushExperimentQuery(
  projectId: string,
  id: string,
  enabled: boolean,
  // While the rest wait for a winner the numbers move: ask again every 30 s.
  poll = false
) {
  return useQuery({
    queryKey: queryKeys.projects.pushExperiment(projectId, id),
    queryFn: async ({ signal }) =>
      (await pushApi.getExperiment(projectId, id, undefined, undefined, signal))
        .data.experiment,
    enabled,
    retry: false,
    refetchInterval: poll ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function usePushDeliveriesQuery(
  projectId: string,
  id: string,
  status?: PushDeliveryStatus,
  limit = 50
) {
  return useInfiniteQuery({
    queryKey: queryKeys.projects.pushDeliveries(projectId, id, status),
    queryFn: async ({ pageParam, signal }) =>
      (
        await pushApi.deliveries(
          projectId,
          id,
          { status, after: pageParam, limit },
          signal
        )
      ).data,
    initialPageParam: 0,
    getNextPageParam: (last) => last.next_after ?? undefined,
    // Keeps the table's height while a new status filter loads, so the page doesn't jump.
    placeholderData: keepPreviousData,
    retry: false,
  });
}

// Each campaign poll that brings new counters while it sends also refreshes the deliveries.
export function useRefreshDeliveriesWhileSending(
  projectId: string,
  campaign: PushCampaign | undefined
) {
  const client = useQueryClient();
  const counters = campaign ? JSON.stringify(campaign.report) : null;
  const previous = useRef<{ counters: string | null; polling: boolean }>({
    counters,
    polling: isPolling(campaign),
  });
  const id = campaign?.id;
  const polling = isPolling(campaign);

  useEffect(() => {
    const before = previous.current;
    previous.current = { counters, polling };
    if (!id || counters === before.counters) return;
    if (!polling && !before.polling) return;
    void client.invalidateQueries({
      queryKey: queryKeys.projects.pushDeliveriesAll(projectId, id),
    });
  }, [client, counters, id, polling, projectId]);
}

const IDLE = {
  data: null as PushEstimate | null,
  error: null as ApiError | null,
  pending: false,
};

// Estimates the audience as it stands, debounced; a newer audience cancels the older request.
export function useAudienceEstimate(
  projectId: string,
  audience: PushAudienceInput | null,
  delay = 500
) {
  const key = audience ? JSON.stringify(audience) : null;
  const debounced = useDebouncedValue(key, delay);
  const settled = !!key && debounced === key;
  const query = useQuery({
    queryKey: queryKeys.projects.pushAudienceEstimate(projectId, key ?? ""),
    queryFn: async ({ signal }) =>
      (
        await pushApi.estimateAudience(
          projectId,
          JSON.parse(key!) as PushAudienceInput,
          signal
        )
      ).data,
    enabled: settled,
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const retry = () => void query.refetch();

  if (!key) return { ...IDLE, retry };
  // Never show numbers while a newer estimate is due or running.
  if (!settled || query.isFetching || query.isPending)
    return { ...IDLE, pending: true, retry };
  if (query.error)
    return {
      data: null,
      error:
        query.error instanceof ApiError
          ? query.error
          : new ApiError("Estimate failed", 0),
      pending: false,
      retry,
    };
  return { data: query.data ?? null, error: null, pending: false, retry };
}

// Undefined while loading, null on error (both mean unknown); refetches on focus for setup done in another tab.
export function usePushChannels(
  enabled = true
): PushChannels | null | undefined {
  const { selectedInstance } = useProjectSelection();
  const { data, isError } = useInstanceConfigQuery(selectedInstance?.id, {
    enabled,
    refetchOnWindowFocus: "always",
  });
  return useMemo(() => {
    if (isError) return null;
    return data ? pushChannels(data) : undefined;
  }, [data, isError]);
}
