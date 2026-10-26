import type { AxiosResponse } from "axios";
import { GET, POST, PATCH, DELETE } from "@/lib/api";
import { config } from "@/lib/config";
import type {
  Dashboard,
  DashboardPayload,
  DashboardUpdatePayload,
  DashboardWidget,
  WidgetPayload,
} from "@/types";

const base = (projectId: string) =>
  `${config.apiPath}/projects/${projectId}/dashboards`;
const writes = { maxRetries: 0 };

export const dashboardsApi = {
  list: (
    projectId: string
  ): Promise<AxiosResponse<{ dashboards: Dashboard[] }>> =>
    GET(base(projectId)),
  create: (
    projectId: string,
    payload: DashboardPayload
  ): Promise<AxiosResponse<{ dashboard: Dashboard }>> =>
    POST(base(projectId), payload, writes),
  update: (
    projectId: string,
    id: number,
    payload: DashboardUpdatePayload
  ): Promise<AxiosResponse<{ dashboard: Dashboard }>> =>
    PATCH(`${base(projectId)}/${id}`, payload, writes),
  destroy: (
    projectId: string,
    id: number
  ): Promise<AxiosResponse<{ message: string }>> =>
    DELETE(`${base(projectId)}/${id}`, writes),
  createWidget: (
    projectId: string,
    dashboardId: number,
    payload: WidgetPayload
  ): Promise<AxiosResponse<{ widget: DashboardWidget }>> =>
    POST(`${base(projectId)}/${dashboardId}/widgets`, payload, writes),
  updateWidget: (
    projectId: string,
    dashboardId: number,
    widgetId: number,
    payload: Partial<WidgetPayload>
  ): Promise<AxiosResponse<{ widget: DashboardWidget }>> =>
    PATCH(
      `${base(projectId)}/${dashboardId}/widgets/${widgetId}`,
      payload,
      writes
    ),
  destroyWidget: (
    projectId: string,
    dashboardId: number,
    widgetId: number
  ): Promise<AxiosResponse<{ message: string }>> =>
    DELETE(`${base(projectId)}/${dashboardId}/widgets/${widgetId}`, writes),
};
