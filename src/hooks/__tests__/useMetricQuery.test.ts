import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { createTestQueryClient } from "./query-test-utils";
import type { AxiosResponse } from "axios";

vi.mock("@/api/analytics/metricQueryService", () => ({
  getMetricQueryAPICall: vi.fn(),
}));

import { getMetricQueryAPICall } from "@/api/analytics/metricQueryService";
import { useMetricQuery } from "../queries/useMetricQuery";

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children);
}
let client: QueryClient;

describe("useMetricQuery", () => {
  beforeEach(() => {
    client = createTestQueryClient();
    vi.clearAllMocks();
  });

  it("forwards params and returns the response", async () => {
    const data = {
      metric: "installs",
      group_by: "country",
      rows: [],
      other: null,
      total: { value: 0 },
    };
    vi.mocked(getMetricQueryAPICall).mockResolvedValue({
      data,
    } as AxiosResponse<typeof data>);
    const params = {
      metric: "installs" as const,
      group_by: "country",
      start_date: "2026-09-01",
    };
    const { result } = renderHook(() => useMetricQuery("p1", params), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMetricQueryAPICall).toHaveBeenCalledWith("p1", params);
    expect(result.current.data).toEqual(data);
  });

  it("does not fetch when params are undefined or enabled is false", async () => {
    renderHook(() => useMetricQuery("p1", undefined), { wrapper: Wrapper });
    renderHook(() => useMetricQuery("p1", { metric: "views" }, false), {
      wrapper: Wrapper,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(getMetricQueryAPICall).not.toHaveBeenCalled();
  });
});
