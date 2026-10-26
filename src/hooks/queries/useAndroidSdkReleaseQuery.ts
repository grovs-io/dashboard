import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

const ANDROID_RELEASE_URL =
  "https://api.github.com/repos/grovs-io/grovs-Android/releases/latest";

/** Latest Android SDK tag from GitHub; null when unavailable (CSP, rate limit). */
export function useAndroidSdkReleaseQuery() {
  return useQuery<string | null>({
    queryKey: queryKeys.sdkReleases.android,
    queryFn: async () => {
      const response = await fetch(ANDROID_RELEASE_URL);
      if (!response.ok) return null;
      const data = (await response.json()) as { tag_name?: string };
      return data.tag_name ?? null;
    },
    staleTime: Infinity,
    retry: false,
  });
}
