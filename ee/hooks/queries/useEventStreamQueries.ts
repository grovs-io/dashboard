"use client";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { eventStreamApi } from "@ee/api/event-stream/eventStreamService";
import { ApiError } from "@/lib/ApiError";

const interval = (error: Error | null) =>
  error instanceof ApiError && [402, 403].includes(error.status)
    ? false
    : 30_000;

export function useEventDestinations(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.eventDestinations(projectId),
    queryFn: async ({ signal }) =>
      (await eventStreamApi.destinations(projectId, signal)).data
        .event_destinations,
    retry: false,
    refetchInterval: (query) => interval(query.state.error),
    refetchIntervalInBackground: false,
  });
}
export function useFeedTokens(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.projects.eventStreamTokens(projectId),
    queryFn: async ({ signal }) =>
      (await eventStreamApi.tokens(projectId, signal)).data.event_stream_tokens,
    enabled,
    retry: false,
    refetchInterval: (query) => (enabled ? interval(query.state.error) : false),
    refetchIntervalInBackground: false,
  });
}
