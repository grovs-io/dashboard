import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  getProjectLinksAPICall,
  getLinksByIdAPICall,
  lookupLinksAPICall,
  availablePathAPICall,
  getRandomPathAPICall,
  getLinkLastOpenAPICall,
  type LinkLastOpen,
} from "@/api/links/linksService";
import type {
  Link,
  GetLinksParams,
  LinksByIdsPayload,
  LinksLookupParams,
} from "@/types";

interface LinksListResult {
  data: Link[];
  totalPages: number;
  totalEntries: number;
}

export function useLinksListQuery(
  projectId: string | undefined,
  params: GetLinksParams | null
) {
  return useQuery<LinksListResult>({
    queryKey: queryKeys.projects.links(projectId!, params ?? undefined),
    queryFn: async () => {
      const response = await getProjectLinksAPICall(projectId!, params!);
      return {
        data: response.data.links,
        totalPages: response.data.meta.total_pages,
        totalEntries: response.data.meta.total_entries,
      };
    },
    enabled: !!projectId && !!params,
  });
}

export function useLinksLookupQuery(
  projectId: string | undefined,
  params: LinksLookupParams | null
) {
  return useQuery({
    queryKey: queryKeys.projects.linksLookup(projectId!, params!),
    queryFn: async ({ signal }) =>
      (await lookupLinksAPICall(projectId!, params!, signal)).data.links,
    enabled: !!projectId && !!params,
  });
}

export function useLinksByIdsQuery(
  projectId: string | undefined,
  ids: LinksByIdsPayload | null
) {
  return useQuery({
    queryKey: queryKeys.projects.linksByIds(projectId!, ids!),
    queryFn: async () => {
      const response = await getLinksByIdAPICall(projectId!, ids!);
      return response.data.links;
    },
    enabled: !!projectId && !!ids,
  });
}

export function usePathAvailableQuery(
  projectId: string | undefined,
  path: string | undefined
) {
  return useQuery({
    queryKey: queryKeys.projects.pathAvailable(projectId!, path!),
    queryFn: async () => {
      const response = await availablePathAPICall(projectId!, path!);
      return response.data.available;
    },
    enabled: !!projectId && !!path && path.length > 0,
  });
}

export function useRandomPathQuery(
  projectId: string | undefined,
  enabled: boolean = false
) {
  return useQuery({
    queryKey: queryKeys.projects.randomPath(projectId!),
    queryFn: async () => {
      const response = await getRandomPathAPICall(projectId!);
      return response.data.valid_path;
    },
    enabled: !!projectId && enabled,
    staleTime: 0,
  });
}

/** Polls until the app opens the link; errors leave `data` undefined. */
export function useLinkLastOpenQuery(
  projectId: string | undefined,
  linkId: string | undefined,
  pollMs: number | false
) {
  return useQuery<LinkLastOpen | null>({
    queryKey: queryKeys.projects.linkLastOpen(projectId!, linkId!),
    queryFn: async () =>
      (await getLinkLastOpenAPICall(projectId!, linkId!)).data.open,
    enabled: !!projectId && !!linkId,
    retry: false,
    refetchInterval: (query) => (query.state.data ? false : pollMs),
  });
}
