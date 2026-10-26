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
import { useDashboardsQuery } from "../queries/useDashboardsQueries";

let client: QueryClient;
function Wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children);
}

describe("useDashboardsQuery", () => {
  beforeEach(() => {
    client = createTestQueryClient();
    vi.clearAllMocks();
  });

  it("unwraps the dashboards envelope", async () => {
    const dashboards = [
      {
        id: 1,
        name: "Growth",
        position: 0,
        widgets: [],
        created_at: "",
        updated_at: "",
      },
    ];
    vi.mocked(dashboardsApi.list).mockResolvedValue({
      data: { dashboards },
    } as AxiosResponse<{ dashboards: typeof dashboards }>);
    const { result } = renderHook(() => useDashboardsQuery("p1"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(dashboards);
    expect(dashboardsApi.list).toHaveBeenCalledWith("p1");
  });

  it("does not fetch without a project", async () => {
    renderHook(() => useDashboardsQuery(undefined), { wrapper: Wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(dashboardsApi.list).not.toHaveBeenCalled();
  });
});
