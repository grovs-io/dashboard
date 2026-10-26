"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { ApiError } from "@/lib/ApiError";
import { segmentsApi } from "@ee/api/segments/segmentsService";
import type {
  SegmentDefinition,
  SegmentEstimate,
  SegmentExport,
} from "@ee/types/segments";

export function useSegmentsQuery(projectId: string, archived: boolean) {
  return useQuery({
    queryKey: queryKeys.projects.segments(projectId, { archived }),
    queryFn: async ({ signal }) =>
      (await segmentsApi.list(projectId, archived, signal)).data,
    retry: false,
  });
}

export function useSegmentQuery(
  projectId: string,
  segmentId: string,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.projects.segment(projectId, segmentId),
    queryFn: async () =>
      (await segmentsApi.get(projectId, segmentId)).data.segment,
    retry: false,
    enabled,
  });
}

export function useSegmentCatalogueQuery(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.segmentCatalogue(projectId),
    queryFn: async ({ signal }) =>
      (await segmentsApi.fields(projectId, signal)).data,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

// One pinned result per page load: breakdown and members read the result_id this returns.
export function useSegmentCountQuery(
  projectId: string,
  segmentId: string,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.projects.segmentCount(projectId, segmentId),
    queryFn: async () => (await segmentsApi.count(projectId, segmentId)).data,
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useSegmentSizeHistoryQuery(
  projectId: string,
  segmentId: string
) {
  return useQuery({
    queryKey: queryKeys.projects.segmentSizeHistory(projectId, segmentId),
    queryFn: async () =>
      (await segmentsApi.sizeHistory(projectId, segmentId)).data.size_history,
    retry: false,
  });
}

export function useIdentifierListPreviewQuery(
  projectId: string,
  segmentId: string,
  q: string
) {
  return useQuery({
    queryKey: queryKeys.projects.segmentIdentifierList(projectId, segmentId, q),
    // Carries its own q so kept-previous rows are labelled with the search they came from.
    queryFn: async ({ signal }) => ({
      ...(
        await segmentsApi.identifierListPreview(projectId, segmentId, q, signal)
      ).data,
      q,
    }),
    retry: false,
    // Keeps the current rows on screen while a new search loads.
    placeholderData: keepPreviousData,
  });
}

export function useSegmentBreakdownQuery(
  projectId: string,
  segmentId: string,
  by: string,
  resultId: string | undefined
) {
  return useQuery({
    queryKey: queryKeys.projects.segmentBreakdown(
      projectId,
      segmentId,
      by,
      resultId
    ),
    queryFn: async () =>
      (
        await segmentsApi.breakdown(projectId, segmentId, {
          by,
          result_id: resultId,
        })
      ).data,
    enabled: !!resultId && by.length > 0,
    retry: false,
  });
}

export function useSegmentMembersQuery(
  projectId: string,
  segmentId: string,
  resultId: string | undefined,
  q = "",
  limit = 50
) {
  return useInfiniteQuery({
    queryKey: queryKeys.projects.segmentMembers(
      projectId,
      segmentId,
      resultId,
      q
    ),
    // The first page pins the result the count already produced; later pages carry it inside the cursor.
    queryFn: async ({ pageParam }) =>
      (
        await segmentsApi.users(
          projectId,
          segmentId,
          pageParam
            ? { cursor: pageParam, limit, ...(q ? { q } : {}) }
            : { result_id: resultId, limit, ...(q ? { q } : {}) }
        )
      ).data,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: !!resultId,
    retry: false,
  });
}

const pending = (exports: SegmentExport[] | undefined) =>
  exports?.some((e) => e.status === "pending") ? 5_000 : false;

export function useSegmentExportsQuery(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.segmentExports(projectId),
    queryFn: async ({ signal }) =>
      (await segmentsApi.exports(projectId, signal)).data.exports,
    retry: false,
    refetchInterval: (query) => pending(query.state.data),
    refetchIntervalInBackground: false,
  });
}

export interface EstimateState {
  data: SegmentEstimate | null;
  error: ApiError | null;
  pending: boolean;
}

const BUSY_BACKOFF_MS = [1500, 3000, 5000, 8000];
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
const isBusy = (error: unknown) =>
  error instanceof ApiError &&
  (error.code === "segment_busy" || error.status === 429);

// One estimate in flight at a time: the server permit outlives a client abort, so edits queue and run once.
export function useSegmentEstimate(
  projectId: string,
  definition: SegmentDefinition,
  valid: boolean,
  delay = 500,
  segmentId?: string
) {
  const [state, setState] = useState<EstimateState>({
    data: null,
    error: null,
    pending: false,
  });
  const [tick, setTick] = useState(0);
  const serialized = JSON.stringify(definition);
  const latest = useRef<string | null>(null);
  const inFlight = useRef(false);
  const alive = useRef(true);

  const run = useCallback(async () => {
    if (inFlight.current || !latest.current) return;
    const target = latest.current;
    inFlight.current = true;
    let attempt = 0;
    while (alive.current) {
      try {
        const { data } = await segmentsApi.estimate(projectId, {
          definition: JSON.parse(target) as SegmentDefinition,
          ...(segmentId ? { segment_id: segmentId } : {}),
        });
        if (alive.current && latest.current === target)
          setState({ data, error: null, pending: false });
        break;
      } catch (error) {
        if (
          isBusy(error) &&
          attempt < BUSY_BACKOFF_MS.length &&
          alive.current &&
          latest.current === target
        ) {
          await sleep(BUSY_BACKOFF_MS[attempt]!);
          attempt += 1;
          continue;
        }
        if (alive.current && latest.current === target)
          setState((s) => ({
            ...s,
            error:
              error instanceof ApiError
                ? error
                : new ApiError("Estimate failed", 0),
            pending: false,
          }));
        break;
      }
    }
    inFlight.current = false;
    if (alive.current && latest.current && latest.current !== target)
      void run();
  }, [projectId, segmentId]);

  useEffect(() => {
    if (!valid) {
      latest.current = null;
      setState((s) => ({ ...s, pending: false }));
      return;
    }
    latest.current = serialized;
    setState((s) => ({ ...s, pending: true, error: null }));
    const timer = setTimeout(() => void run(), delay);
    return () => clearTimeout(timer);
  }, [serialized, valid, delay, tick, run]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  return { ...state, retry: () => setTick((t) => t + 1) };
}
