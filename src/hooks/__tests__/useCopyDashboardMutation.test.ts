import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import type { AxiosResponse } from "axios";
import { createTestQueryClient } from "./query-test-utils";

vi.mock("@/api/dashboards/dashboardsService", () => ({
  dashboardsApi: { create: vi.fn(), createWidget: vi.fn() },
}));
import { dashboardsApi } from "@/api/dashboards/dashboardsService";
import { queryKeys } from "@/lib/queryKeys";
import { useCopyDashboardMutation } from "../mutations/useDashboardsMutations";
import {
  builtinDashboard,
  widgetPayload,
} from "@/components/dashboards/builtinDashboards";

let client: QueryClient;
function Wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children);
}
const ok = <T>(data: T) => ({ data }) as AxiosResponse<T>;
const created = {
  id: 9,
  name: "Acquisition (copy)",
  position: 0,
  widgets: [],
  created_at: "",
  updated_at: "",
};

describe("useCopyDashboardMutation", () => {
  beforeEach(() => {
    client = createTestQueryClient();
    vi.clearAllMocks();
  });

  it("creates the board, then every widget in order, and refetches the list once", async () => {
    vi.mocked(dashboardsApi.create).mockResolvedValue(
      ok({ dashboard: created })
    );
    vi.mocked(dashboardsApi.createWidget).mockResolvedValue(
      ok({ widget: {} }) as never
    );
    const spy = vi.spyOn(client, "invalidateQueries");
    const widgets = builtinDashboard("acquisition")!.widgets.map(widgetPayload);
    const { result } = renderHook(() => useCopyDashboardMutation("p1"), {
      wrapper: Wrapper,
    });
    const res = await result.current.mutateAsync({
      name: "Acquisition (copy)",
      widgets,
    });
    expect(res.dashboard.id).toBe(9);
    expect(res.failed).toEqual([]);
    expect(dashboardsApi.create).toHaveBeenCalledWith("p1", {
      name: "Acquisition (copy)",
    });
    expect(
      vi
        .mocked(dashboardsApi.createWidget)
        .mock.calls.map((c) => [c[0], c[1], c[2].title])
    ).toEqual(widgets.map((w) => ["p1", 9, w.title]));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy).toHaveBeenCalledWith({
      queryKey: queryKeys.projects.dashboards("p1"),
    });
  });

  it("skips a failing widget, keeps going and reports it", async () => {
    vi.mocked(dashboardsApi.create).mockResolvedValue(
      ok({ dashboard: created })
    );
    vi.mocked(dashboardsApi.createWidget)
      .mockResolvedValueOnce(ok({ widget: {} }) as never)
      .mockRejectedValueOnce(new Error("limit"))
      .mockResolvedValue(ok({ widget: {} }) as never);
    const spy = vi.spyOn(client, "invalidateQueries");
    const widgets = builtinDashboard("links")!.widgets.map(widgetPayload);
    const { result } = renderHook(() => useCopyDashboardMutation("p1"), {
      wrapper: Wrapper,
    });
    const res = await result.current.mutateAsync({
      name: "Links (copy)",
      widgets,
    });
    expect(dashboardsApi.createWidget).toHaveBeenCalledTimes(widgets.length);
    expect(res.failed.map((f) => f.title)).toEqual([widgets[1]!.title]);
    await waitFor(() => expect(spy).toHaveBeenCalled());
  });

  it("throws when the board itself can't be created", async () => {
    vi.mocked(dashboardsApi.create).mockRejectedValue(new Error("limit"));
    const { result } = renderHook(() => useCopyDashboardMutation("p1"), {
      wrapper: Wrapper,
    });
    await expect(
      result.current.mutateAsync({ name: "X", widgets: [] })
    ).rejects.toThrow("limit");
    expect(dashboardsApi.createWidget).not.toHaveBeenCalled();
  });
});
