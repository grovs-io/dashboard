import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { dashboardsApi } from "@/api/dashboards/dashboardsService";
import type { Dashboard, DashboardWidget } from "@/types";

/** Widgets saved before panels existed come without `kind`; they are metric widgets. */
function normalizeWidget(w: DashboardWidget): DashboardWidget {
  return w.kind === "panel" ? w : { ...w, kind: "metric", panel: null };
}

export function useDashboardsQuery(projectId: string | undefined) {
  return useQuery<Dashboard[]>({
    queryKey: queryKeys.projects.dashboards(projectId!),
    queryFn: async () =>
      (await dashboardsApi.list(projectId!)).data.dashboards.map((d) => ({
        ...d,
        widgets: d.widgets.map(normalizeWidget),
      })),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}
