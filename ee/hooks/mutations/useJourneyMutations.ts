"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { journeysApi } from "@ee/api/journeys/journeysService";
import type { Journey, JourneyAction, JourneyInput } from "@ee/types/journey";

// The answer goes into the cache first, so a builder opened next starts from the version just saved.
function useInvalidate(projectId: string) {
  const client = useQueryClient();
  return (answer?: unknown) => {
    const journey = answer as Journey | undefined;
    if (journey && typeof journey === "object" && "lock_version" in journey)
      client.setQueryData(
        queryKeys.projects.journey(projectId, journey.id),
        journey
      );
    void client.invalidateQueries({
      queryKey: queryKeys.projects.detail(projectId),
    });
  };
}

export function useSaveJourney(projectId: string) {
  const onSuccess = useInvalidate(projectId);
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string | null;
      input: Partial<JourneyInput>;
    }) =>
      (id
        ? await journeysApi.update(projectId, id, input)
        : await journeysApi.create(projectId, input)
      ).data.journey,
    onSuccess,
  });
}

export function useJourneyStep(projectId: string) {
  const onSuccess = useInvalidate(projectId);
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: JourneyAction }) =>
      (await journeysApi.step(projectId, id, action)).data.journey,
    onSuccess,
  });
}

export function useDuplicateJourney(projectId: string) {
  const onSuccess = useInvalidate(projectId);
  return useMutation({
    mutationFn: async (id: string) =>
      (await journeysApi.duplicate(projectId, id)).data.journey,
    onSuccess,
  });
}

export function useDeleteJourney(projectId: string) {
  const onSuccess = useInvalidate(projectId);
  return useMutation({
    mutationFn: async (id: string) => {
      await journeysApi.remove(projectId, id);
    },
    onSuccess,
  });
}

export function useJourneyImage(projectId: string, journeyId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      lockVersion,
    }: {
      file: File;
      lockVersion: number;
    }) =>
      (await journeysApi.uploadImage(projectId, journeyId, file, lockVersion))
        .data,
    // The upload bumps lock_version, so a later save or step must send the new one.
    onSuccess: ({ lock_version }) => {
      if (lock_version === undefined) return;
      client.setQueryData<Journey>(
        queryKeys.projects.journey(projectId, journeyId),
        (old) =>
          old && lock_version > old.lock_version
            ? { ...old, lock_version }
            : old
      );
    },
  });
}
