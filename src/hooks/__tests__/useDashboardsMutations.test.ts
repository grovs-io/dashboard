import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { createTestQueryClient } from "./query-test-utils";
import type { AxiosResponse } from "axios";

vi.mock("@/api/dashboards/dashboardsService", () => ({
  dashboardsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn(),
    createWidget: vi.fn(),
    updateWidget: vi.fn(),
    destroyWidget: vi.fn(),
  },
}));
import { dashboardsApi } from "@/api/dashboards/dashboardsService";
import { queryKeys } from "@/lib/queryKeys";
import {
  useCreateDashboardMutation,
  useCreateWidgetMutation,
  useDeleteDashboardMutation,
  useUpdateDashboardMutation,
} from "../mutations/useDashboardsMutations";

let client: QueryClient;
function Wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children);
}
const ok = <T>(data: T) => ({ data }) as AxiosResponse<T>;

describe("dashboard mutations", () => {
  beforeEach(() => {
    client = createTestQueryClient();
    vi.clearAllMocks();
  });

  it("creates a dashboard and invalidates the list", async () => {
    vi.mocked(dashboardsApi.create).mockResolvedValue(
      ok({
        dashboard: {
          id: 2,
          name: "New",
          position: 1,
          widgets: [],
          created_at: "",
          updated_at: "",
        },
      })
    );
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateDashboardMutation("p1"), {
      wrapper: Wrapper,
    });
    const res = await result.current.mutateAsync({ name: "New" });
    expect(res.id).toBe(2);
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({
        queryKey: queryKeys.projects.dashboards("p1"),
      })
    );
  });

  it("resolves mutateAsync only after the list invalidation settles", async () => {
    vi.mocked(dashboardsApi.destroy).mockResolvedValue(ok({ message: "ok" }));
    let release!: () => void;
    const spy = vi.spyOn(client, "invalidateQueries").mockImplementation(
      () =>
        new Promise<void>((r) => {
          release = r;
        })
    );
    const { result } = renderHook(() => useDeleteDashboardMutation("p1"), {
      wrapper: Wrapper,
    });
    let done = false;
    const pending = result.current.mutateAsync(1).then(() => {
      done = true;
    });
    await waitFor(() => expect(spy).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    expect(done).toBe(false);
    release();
    await pending;
    expect(done).toBe(true);
  });

  it("creates a widget with the payload and reorders through update", async () => {
    vi.mocked(dashboardsApi.createWidget).mockResolvedValue(
      ok({
        widget: {
          id: 9,
          dashboard_id: 1,
          title: "T",
          kind: "metric",
          panel: null,
          viz: "bar",
          size: "md",
          query: { metric: "installs" },
          filters: [],
          position: 0,
          created_at: "",
          updated_at: "",
        },
      })
    );
    vi.mocked(dashboardsApi.update).mockResolvedValue(
      ok({
        dashboard: {
          id: 1,
          name: "Growth",
          position: 0,
          widgets: [],
          created_at: "",
          updated_at: "",
        },
      })
    );
    const w = renderHook(() => useCreateWidgetMutation("p1"), {
      wrapper: Wrapper,
    });
    await w.result.current.mutateAsync({
      dashboardId: 1,
      payload: {
        title: "T",
        kind: "metric",
        panel: null,
        viz: "bar",
        size: "md",
        query: { metric: "installs" },
        filters: [],
      },
    });
    expect(dashboardsApi.createWidget).toHaveBeenCalledWith("p1", 1, {
      title: "T",
      kind: "metric",
      panel: null,
      viz: "bar",
      size: "md",
      query: { metric: "installs" },
      filters: [],
    });
    const u = renderHook(() => useUpdateDashboardMutation("p1"), {
      wrapper: Wrapper,
    });
    await u.result.current.mutateAsync({
      dashboardId: 1,
      payload: { widget_order: [9] },
    });
    expect(dashboardsApi.update).toHaveBeenCalledWith("p1", 1, {
      widget_order: [9],
    });
  });

  it("rejects without a project", async () => {
    const { result } = renderHook(() => useCreateDashboardMutation(undefined), {
      wrapper: Wrapper,
    });
    await expect(result.current.mutateAsync({ name: "x" })).rejects.toThrow(
      "No project selected"
    );
  });
});
