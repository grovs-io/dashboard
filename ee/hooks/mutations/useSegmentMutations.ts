"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { segmentsApi } from "@ee/api/segments/segmentsService";
import type { SegmentInput } from "@ee/types/segments";

// Not awaited: a segment refetch can recompute a large result, and the mutation must not stay pending for it.
function useInvalidateSegments(projectId: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({
      queryKey: queryKeys.projects.detail(projectId),
    });
  };
}

// Exports and list uploads change no membership by themselves, so they must not re-run the count.
function useInvalidateKeys(
  keys: (segmentId: string) => readonly (readonly unknown[])[]
) {
  const client = useQueryClient();
  return (segmentId: string) => {
    for (const key of keys(segmentId))
      void client.invalidateQueries({ queryKey: key });
  };
}

export function useCreateSegmentMutation(projectId: string) {
  const invalidate = useInvalidateSegments(projectId);
  return useMutation({
    mutationFn: async (input: SegmentInput) =>
      (await segmentsApi.create(projectId, input)).data.segment,
    onSuccess: invalidate,
  });
}

export function useUpdateSegmentMutation(projectId: string) {
  const invalidate = useInvalidateSegments(projectId);
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: SegmentInput }) =>
      (await segmentsApi.update(projectId, id, input)).data.segment,
    onSuccess: invalidate,
  });
}

export function useArchiveSegmentMutation(projectId: string) {
  const invalidate = useInvalidateSegments(projectId);
  return useMutation({
    mutationFn: async (id: string) =>
      (await segmentsApi.archive(projectId, id)).data,
    onSuccess: invalidate,
  });
}

export function useRestoreSegmentMutation(projectId: string) {
  const invalidate = useInvalidateSegments(projectId);
  return useMutation({
    mutationFn: async (id: string) =>
      (await segmentsApi.restore(projectId, id)).data.segment,
    onSuccess: invalidate,
  });
}

export function useReplaceIdentifierListMutation(projectId: string) {
  const invalidate = useInvalidateKeys((id) => [
    queryKeys.projects.segment(projectId, id),
    queryKeys.projects.segments(projectId),
    queryKeys.projects.segmentCount(projectId, id),
    queryKeys.projects.segmentMembersAll(projectId, id),
    queryKeys.projects.segmentBreakdownAll(projectId, id),
    queryKeys.projects.segmentIdentifierListAll(projectId, id),
  ]);
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: FormData | { identifiers: string[] };
    }) =>
      (await segmentsApi.replaceIdentifierList(projectId, id, payload)).data,
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useRequestSegmentExportMutation(projectId: string) {
  const invalidate = useInvalidateKeys(() => [
    queryKeys.projects.segmentExports(projectId),
  ]);
  return useMutation({
    mutationFn: async (id: string) =>
      (await segmentsApi.requestExport(projectId, id)).data.export,
    onSuccess: (_data, id) => invalidate(id),
  });
}
