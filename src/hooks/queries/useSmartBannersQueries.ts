import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  getSmartBannerAPICall,
  getSmartBannersAPICall,
  getSmartBannersStatusAPICall,
} from "@/api/smartBanners/smartBannersService";

export function useSmartBannersQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projects.smartBanners(projectId!),
    queryFn: async () =>
      (await getSmartBannersAPICall(projectId!)).data.smart_banners,
    enabled: !!projectId,
  });
}

// The editor seeds its form once, so it must never start from a cached copy.
// `enabled` lets a closed dialog turn this off, so a later cache removal (e.g. delete) can't trigger a refetch.
export function useSmartBannerQuery(
  projectId: string | undefined,
  bannerId: number | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.projects.smartBanner(projectId!, bannerId!),
    queryFn: async () =>
      (await getSmartBannerAPICall(projectId!, bannerId!)).data.smart_banner,
    enabled:
      enabled &&
      !!projectId &&
      bannerId !== undefined &&
      !Number.isNaN(bannerId),
    gcTime: 0,
    refetchOnMount: "always",
  });
}

// Refetches on focus so a user back from installing the SDK sees it connect.
export function useSmartBannersStatusQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projects.smartBannersStatus(projectId!),
    queryFn: async () => (await getSmartBannersStatusAPICall(projectId!)).data,
    enabled: !!projectId,
    refetchOnWindowFocus: true,
  });
}
