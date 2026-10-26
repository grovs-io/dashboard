"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { inAppApi } from "@ee/api/in_app/inAppService";
import type {
  InAppCampaign,
  InAppCampaignInput,
  InAppImageSlot,
  InAppSettings,
  InAppStep,
  InAppVariantId,
} from "@ee/types/inApp";

// Not awaited: the list and report refetch must not keep the mutation pending.
// The answer goes into the cache first, so an editor opened next starts from the version just saved.
function useInvalidate(projectId: string) {
  const client = useQueryClient();
  return (answer?: unknown) => {
    const campaign = answer as InAppCampaign | undefined;
    if (campaign && typeof campaign === "object" && "lock_version" in campaign)
      client.setQueryData(
        queryKeys.projects.inAppCampaign(projectId, campaign.id),
        campaign
      );
    void client.invalidateQueries({
      queryKey: queryKeys.projects.detail(projectId),
    });
  };
}

export function useSaveInAppCampaign(projectId: string) {
  const onSuccess = useInvalidate(projectId);
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string | null;
      input: InAppCampaignInput;
    }) =>
      (id
        ? await inAppApi.update(projectId, id, input)
        : await inAppApi.create(projectId, input)
      ).data.in_app_campaign,
    onSuccess,
  });
}

export function useInAppStep(projectId: string) {
  const onSuccess = useInvalidate(projectId);
  return useMutation({
    mutationFn: async ({ id, step }: { id: string; step: InAppStep }) =>
      (await inAppApi.step(projectId, id, step)).data.in_app_campaign,
    onSuccess,
  });
}

export function useInAppAudienceUpdate(projectId: string) {
  const onSuccess = useInvalidate(projectId);
  return useMutation({
    mutationFn: async (id: string) =>
      (await inAppApi.updateAudience(projectId, id)).data.in_app_campaign,
    onSuccess,
  });
}

export function useInAppTest(projectId: string) {
  return useMutation({
    mutationFn: async ({
      id,
      identifier,
    }: {
      id: string;
      identifier: string;
    }) => (await inAppApi.test(projectId, id, identifier)).data.devices,
  });
}

export function useDuplicateInAppCampaign(projectId: string) {
  const onSuccess = useInvalidate(projectId);
  return useMutation({
    mutationFn: async ({
      id,
      variant,
    }: {
      id: string;
      variant?: "a" | InAppVariantId;
    }) =>
      (await inAppApi.duplicate(projectId, id, variant)).data.in_app_campaign,
    onSuccess,
  });
}

export function useDeleteInAppCampaign(projectId: string) {
  const onSuccess = useInvalidate(projectId);
  return useMutation({
    mutationFn: async (id: string) => {
      await inAppApi.remove(projectId, id);
    },
    onSuccess,
  });
}

export function useInAppImage(projectId: string) {
  const onSuccess = useInvalidate(projectId);
  return useMutation({
    mutationFn: async ({
      id,
      slot,
      file,
    }: {
      id: string;
      slot: InAppImageSlot;
      file: File | null;
    }) =>
      (file
        ? await inAppApi.uploadImage(projectId, id, slot, file)
        : await inAppApi.removeImage(projectId, id, slot)
      ).data.in_app_campaign,
    onSuccess,
  });
}

export function useUpdateInAppSettings(projectId: string) {
  const onSuccess = useInvalidate(projectId);
  return useMutation({
    mutationFn: async (input: Partial<InAppSettings>) =>
      (await inAppApi.updateSettings(projectId, input)).data.in_app_settings,
    onSuccess,
  });
}
