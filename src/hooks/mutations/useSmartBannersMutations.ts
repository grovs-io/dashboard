import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  createSmartBannerAPICall,
  deleteSmartBannerAPICall,
  duplicateSmartBannerAPICall,
  reorderSmartBannersAPICall,
  updateSmartBannerAPICall,
} from "@/api/smartBanners/smartBannersService";
import type { SmartBanner } from "@/types";

const noProject = () => Promise.reject(new Error("No project selected"));

export function useCreateSmartBannerMutation(projectId: string | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (fd: FormData) => {
      if (!projectId) return noProject();
      return (await createSmartBannerAPICall(projectId, fd)).data.smart_banner;
    },
    // Not awaited: the dialog closes as soon as the create resolves, without waiting on the list refetch.
    onSuccess: () =>
      void (
        projectId &&
        client.invalidateQueries({
          queryKey: queryKeys.projects.smartBanners(projectId),
        })
      ),
  });
}

export function useUpdateSmartBannerMutation(projectId: string | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fd }: { id: number; fd: FormData }) => {
      if (!projectId) return noProject();
      return (await updateSmartBannerAPICall(projectId, id, fd)).data
        .smart_banner;
    },
    // Store the server's banner; a refetch would rerun the list's stats query.
    onSuccess: (banner) => {
      if (!projectId) return;
      client.setQueryData(
        queryKeys.projects.smartBanner(projectId, banner.id),
        banner
      );
      // Re-sort: a restore moves the banner to the last priority server-side.
      client.setQueryData<SmartBanner[]>(
        queryKeys.projects.smartBanners(projectId),
        (list) =>
          list
            ?.map((b) => (b.id === banner.id ? banner : b))
            .sort((a, b) => a.priority - b.priority || a.id - b.id)
      );
    },
  });
}

export function useDeleteSmartBannerMutation(projectId: string | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      if (!projectId) return noProject();
      await deleteSmartBannerAPICall(projectId, id);
      return id;
    },
    onSuccess: (id) => {
      if (!projectId) return;
      client.removeQueries({
        queryKey: queryKeys.projects.smartBanner(projectId, id),
      });
      client.setQueryData<SmartBanner[]>(
        queryKeys.projects.smartBanners(projectId),
        (list) => list?.filter((b) => b.id !== id)
      );
    },
  });
}

export function useDuplicateSmartBannerMutation(projectId: string | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      if (!projectId) return noProject();
      return (await duplicateSmartBannerAPICall(projectId, id)).data
        .smart_banner;
    },
    // Not awaited: the dialog/list reacts as soon as the duplicate resolves, without waiting on the list refetch.
    onSuccess: () =>
      void (
        projectId &&
        client.invalidateQueries({
          queryKey: queryKeys.projects.smartBanners(projectId),
        })
      ),
  });
}

// Reordered banners first, then any the ids leave out (archived ones).
const withRest = (ordered: SmartBanner[], all: SmartBanner[] | undefined) => {
  const seen = new Set(ordered.map((b) => b.id));
  return [...ordered, ...(all ?? []).filter((b) => !seen.has(b.id))];
};

export function useReorderSmartBannersMutation(projectId: string | undefined) {
  const client = useQueryClient();
  const key = queryKeys.projects.smartBanners(projectId!);
  return useMutation({
    mutationFn: async (ids: number[]) => {
      if (!projectId) return noProject();
      return (await reorderSmartBannersAPICall(projectId, ids)).data
        .smart_banners;
    },
    onMutate: async (ids: number[]) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<SmartBanner[]>(key);
      if (previous) {
        const byId = new Map(previous.map((b) => [b.id, b]));
        const ordered = ids
          .map((id) => byId.get(id))
          .filter((b): b is SmartBanner => !!b)
          // Rewritten to the new index so a concurrent update's re-sort by priority can't flicker it back.
          .map((b, i) => ({ ...b, priority: i }));
        client.setQueryData(key, withRest(ordered, previous));
      }
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
      client.invalidateQueries({ queryKey: key });
    },
    onSuccess: (list) =>
      client.setQueryData<SmartBanner[]>(key, (previous) =>
        withRest(list, previous)
      ),
  });
}
