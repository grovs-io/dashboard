"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { pushApi } from "@ee/api/push/pushCampaignsService";
import type { PushCampaignInput, PushScheduleInput } from "@ee/types/push";
import type { VariantId } from "@ee/types/experiment";

// Not awaited: mirrors useSegmentMutations, the report/list refetch must not keep the mutation pending.
export function useInvalidatePush(projectId: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({
      queryKey: queryKeys.projects.detail(projectId),
    });
  };
}

export function useCreatePushCampaign(projectId: string) {
  const invalidate = useInvalidatePush(projectId);
  return useMutation({
    mutationFn: async (input: PushCampaignInput | FormData) =>
      (await pushApi.create(projectId, input)).data.push_campaign,
    onSuccess: invalidate,
  });
}

export function useUpdatePushCampaign(projectId: string) {
  const invalidate = useInvalidatePush(projectId);
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: PushCampaignInput | FormData;
    }) => (await pushApi.update(projectId, id, input)).data.push_campaign,
    onSuccess: invalidate,
  });
}

export function useRemovePushImage(projectId: string) {
  const invalidate = useInvalidatePush(projectId);
  return useMutation({
    mutationFn: async (id: string) =>
      (await pushApi.removeImage(projectId, id)).data.push_campaign,
    onSuccess: invalidate,
  });
}

export function useSendPushCampaign(projectId: string) {
  const invalidate = useInvalidatePush(projectId);
  return useMutation({
    mutationFn: async ({
      id,
      schedule,
    }: {
      id: string;
      schedule: PushScheduleInput;
    }) => (await pushApi.send(projectId, id, schedule)).data.push_campaign,
    onSuccess: invalidate,
  });
}

export function useCancelPushCampaign(projectId: string) {
  const invalidate = useInvalidatePush(projectId);
  return useMutation({
    mutationFn: async (id: string) =>
      (await pushApi.cancel(projectId, id)).data.push_campaign,
    onSuccess: invalidate,
  });
}

export function useSendWinner(projectId: string) {
  const invalidate = useInvalidatePush(projectId);
  return useMutation({
    mutationFn: async ({
      id,
      variant,
    }: {
      id: string;
      variant: "a" | VariantId;
    }) => (await pushApi.sendWinner(projectId, id, variant)).data.push_campaign,
    onSuccess: invalidate,
  });
}
