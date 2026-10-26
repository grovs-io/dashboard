import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { dashboardsApi } from "@/api/dashboards/dashboardsService";
import type {
  DashboardPayload,
  DashboardUpdatePayload,
  WidgetPayload,
} from "@/types";

function useInvalidateDashboards(projectId: string | undefined) {
  const client = useQueryClient();
  // Narrow on purpose: a broad project invalidation would re-run every widget's ClickHouse query.
  return () =>
    projectId
      ? client.invalidateQueries({
          queryKey: queryKeys.projects.dashboards(projectId),
        })
      : undefined;
}

const noProject = () => Promise.reject(new Error("No project selected"));

export function useCreateDashboardMutation(projectId: string | undefined) {
  const invalidate = useInvalidateDashboards(projectId);
  return useMutation({
    mutationFn: async (payload: DashboardPayload) =>
      projectId
        ? (await dashboardsApi.create(projectId, payload)).data.dashboard
        : noProject(),
    onSuccess: invalidate,
  });
}

export function useUpdateDashboardMutation(projectId: string | undefined) {
  const invalidate = useInvalidateDashboards(projectId);
  return useMutation({
    mutationFn: async ({
      dashboardId,
      payload,
    }: {
      dashboardId: number;
      payload: DashboardUpdatePayload;
    }) =>
      projectId
        ? (await dashboardsApi.update(projectId, dashboardId, payload)).data
            .dashboard
        : noProject(),
    onSuccess: invalidate,
  });
}

export function useDeleteDashboardMutation(projectId: string | undefined) {
  const invalidate = useInvalidateDashboards(projectId);
  return useMutation({
    mutationFn: async (dashboardId: number) =>
      projectId
        ? (await dashboardsApi.destroy(projectId, dashboardId)).data
        : noProject(),
    onSuccess: invalidate,
  });
}

export function useCreateWidgetMutation(projectId: string | undefined) {
  const invalidate = useInvalidateDashboards(projectId);
  return useMutation({
    mutationFn: async ({
      dashboardId,
      payload,
    }: {
      dashboardId: number;
      payload: WidgetPayload;
    }) =>
      projectId
        ? (await dashboardsApi.createWidget(projectId, dashboardId, payload))
            .data.widget
        : noProject(),
    onSuccess: invalidate,
  });
}

export function useUpdateWidgetMutation(projectId: string | undefined) {
  const invalidate = useInvalidateDashboards(projectId);
  return useMutation({
    mutationFn: async ({
      dashboardId,
      widgetId,
      payload,
    }: {
      dashboardId: number;
      widgetId: number;
      payload: Partial<WidgetPayload>;
    }) =>
      projectId
        ? (
            await dashboardsApi.updateWidget(
              projectId,
              dashboardId,
              widgetId,
              payload
            )
          ).data.widget
        : noProject(),
    onSuccess: invalidate,
  });
}

export function useDeleteWidgetMutation(projectId: string | undefined) {
  const invalidate = useInvalidateDashboards(projectId);
  return useMutation({
    mutationFn: async ({
      dashboardId,
      widgetId,
    }: {
      dashboardId: number;
      widgetId: number;
    }) =>
      projectId
        ? (await dashboardsApi.destroyWidget(projectId, dashboardId, widgetId))
            .data
        : noProject(),
    onSuccess: invalidate,
  });
}

/**
 * Creates a board, then its widgets one by one in order; the list refetches once at the end.
 * A widget that fails is skipped and reported in `failed`, leaving a partial board.
 */
export function useCopyDashboardMutation(projectId: string | undefined) {
  const invalidate = useInvalidateDashboards(projectId);
  return useMutation({
    mutationFn: async ({
      name,
      widgets,
    }: {
      name: string;
      widgets: WidgetPayload[];
    }) => {
      if (!projectId) return noProject();
      const dashboard = (await dashboardsApi.create(projectId, { name })).data
        .dashboard;
      const failed: { title: string; error: unknown }[] = [];
      for (const w of widgets) {
        try {
          await dashboardsApi.createWidget(projectId, dashboard.id, w);
        } catch (error) {
          failed.push({ title: w.title, error });
        }
      }
      return { dashboard, failed };
    },
    onSettled: invalidate,
  });
}
