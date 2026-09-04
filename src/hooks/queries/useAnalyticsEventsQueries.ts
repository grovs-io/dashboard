import {
  useQuery,
  useInfiniteQuery,
  keepPreviousData,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  getAnalyticsEventsAPICall,
  getAnalyticsEventByIdAPICall,
  getAnalyticsEventVolumeAPICall,
  getAnalyticsEventFieldValuesAPICall,
  getAnalyticsEventFieldsAPICall,
} from "@/api/analytics/analyticsEventsService";
import type {
  EventsListResponse,
  AnalyticsEvent,
  EventVolumeResponse,
  EventFieldValuesResponse,
  EventFieldsResponse,
  AnalyticsEventsParams,
  AnalyticsEventVolumeParams,
  AnalyticsFieldValuesParams,
} from "@/types";

export function useAnalyticsEventsInfiniteQuery(
  projectId: string | undefined,
  params?: AnalyticsEventsParams,
  enabled = true
) {
  return useInfiniteQuery<EventsListResponse>({
    queryKey: [
      ...queryKeys.projects.analyticsEvents(projectId!, params),
      "infinite",
    ],
    queryFn: async ({ pageParam }) => {
      const p = { ...params, cursor: pageParam as string | undefined };
      const response = await getAnalyticsEventsAPICall(projectId!, p);
      return response.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    placeholderData: keepPreviousData,
    enabled: enabled && !!projectId,
  });
}

export function useAnalyticsEventsQuery(
  projectId: string | undefined,
  params?: AnalyticsEventsParams
) {
  return useQuery<EventsListResponse>({
    queryKey: queryKeys.projects.analyticsEvents(projectId!, params),
    queryFn: async () => {
      const response = await getAnalyticsEventsAPICall(projectId!, params);
      return response.data;
    },
    enabled: !!projectId,
  });
}

export function useAnalyticsEventDetailQuery(
  projectId: string | undefined,
  eventId: string | undefined
) {
  return useQuery<AnalyticsEvent>({
    queryKey: queryKeys.projects.analyticsEventDetail(projectId!, eventId!),
    queryFn: async () => {
      const response = await getAnalyticsEventByIdAPICall(projectId!, eventId!);
      // API wraps the event in a `{ data: {...} }` envelope — unwrap it.
      return response.data.data;
    },
    enabled: !!projectId && !!eventId,
  });
}

export function useAnalyticsEventVolumeQuery(
  projectId: string | undefined,
  params?: AnalyticsEventVolumeParams,
  enabled = true
) {
  return useQuery<EventVolumeResponse>({
    queryKey: queryKeys.projects.analyticsEventVolume(projectId!, params),
    queryFn: async () => {
      const response = await getAnalyticsEventVolumeAPICall(projectId!, params);
      return response.data;
    },
    placeholderData: keepPreviousData,
    enabled: enabled && !!projectId,
  });
}

export function useAnalyticsEventFieldValuesQuery(
  projectId: string | undefined,
  params: AnalyticsFieldValuesParams | undefined
) {
  return useInfiniteQuery<EventFieldValuesResponse>({
    queryKey: [
      ...queryKeys.projects.analyticsEventFieldValues(projectId!, params),
      "infinite",
    ],
    queryFn: async ({ pageParam }) => {
      const p = {
        ...params!,
        ...(pageParam ? { cursor: pageParam as string | number } : {}),
      };
      const response = await getAnalyticsEventFieldValuesAPICall(projectId!, p);
      return response.data;
    },
    initialPageParam: undefined as string | number | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: !!projectId && !!params,
  });
}

export function useAnalyticsEventFieldsQuery(
  projectId: string | undefined,
  enabled = true
) {
  return useQuery<EventFieldsResponse>({
    queryKey: queryKeys.projects.analyticsEventFields(projectId!),
    queryFn: async () => {
      const response = await getAnalyticsEventFieldsAPICall(projectId!);
      return response.data;
    },
    enabled: enabled && !!projectId,
  });
}
