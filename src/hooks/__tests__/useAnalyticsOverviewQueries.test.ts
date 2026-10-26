import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { createTestQueryClient } from "./query-test-utils";
import type { AxiosResponse } from "axios";

vi.mock("@/api/analytics/analyticsOverviewService", () => ({
  getOverviewVersionsAPICall: vi.fn(),
  getOverviewVersionDistributionAPICall: vi.fn(),
  getOverviewVersionFunnelAPICall: vi.fn(),
  getOverviewUserTrendsAPICall: vi.fn(),
  getOverviewSourcesBreakdownAPICall: vi.fn(),
  getOverviewKeyMetricsAPICall: vi.fn(),
  getOverviewKeyMetricSeriesAPICall: vi.fn(),
}));

import {
  getOverviewKeyMetricsAPICall,
  getOverviewKeyMetricSeriesAPICall,
  getOverviewUserTrendsAPICall,
} from "@/api/analytics/analyticsOverviewService";
import {
  useOverviewKeyMetricsQuery,
  useOverviewKeyMetricSeriesQuery,
  useOverviewUserTrendsQuery,
} from "../queries/useAnalyticsOverviewQueries";

const ok = <T>(data: T) => ({ data }) as AxiosResponse<T>;

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

describe("useAnalyticsOverviewQueries", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = createTestQueryClient();
    vi.clearAllMocks();
  });

  it("forwards filters to key-metrics and exposes unsupported_metrics", async () => {
    vi.mocked(getOverviewKeyMetricsAPICall).mockResolvedValue(
      ok({ metrics: {} as never, unsupported_metrics: ["revenue"] })
    );
    const params = {
      start_date: "2026-09-01",
      end_date: "2026-09-25",
      filters: '[{"field":"country","operator":"is","value":"RO"}]',
    };
    const { result } = renderHook(
      () => useOverviewKeyMetricsQuery("p1", params),
      { wrapper: wrapper(client) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getOverviewKeyMetricsAPICall).toHaveBeenCalledWith("p1", params);
    expect(result.current.data?.unsupported_metrics).toEqual(["revenue"]);
  });

  it("forwards granularity to series and trends", async () => {
    vi.mocked(getOverviewKeyMetricSeriesAPICall).mockResolvedValue(
      ok({ metric: "installs", points: [] })
    );
    vi.mocked(getOverviewUserTrendsAPICall).mockResolvedValue(
      ok({ points: [] })
    );
    const series = {
      metric: "installs",
      granularity: "week" as const,
      start_date: "2026-09-01",
    };
    const trends = { granularity: "month" as const, start_date: "2026-09-01" };

    const s = renderHook(() => useOverviewKeyMetricSeriesQuery("p1", series), {
      wrapper: wrapper(client),
    });
    const t = renderHook(() => useOverviewUserTrendsQuery("p1", trends), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(s.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(t.result.current.isSuccess).toBe(true));
    expect(getOverviewKeyMetricSeriesAPICall).toHaveBeenCalledWith(
      "p1",
      series
    );
    expect(getOverviewUserTrendsAPICall).toHaveBeenCalledWith("p1", trends);
  });
});
