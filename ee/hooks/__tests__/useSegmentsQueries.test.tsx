import type { SegmentDefinition } from "@ee/types/segments";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AxiosHeaders } from "axios";
import { GET, POST } from "@/lib/api";
import { ApiError } from "@/lib/ApiError";
import {
  useSegmentCatalogueQuery,
  useSegmentEstimate,
  useSegmentExportsQuery,
  useSegmentMembersQuery,
  useSegmentsQuery,
} from "../queries/useSegmentsQueries";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));

const ok = (data: unknown) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config: { headers: new AxiosHeaders() },
});
const wrap = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
};
const definition: SegmentDefinition = {
  version: 1,
  operator: "or",
  groups: [],
};

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("segments queries", () => {
  it("lists under the project key with the archived flag", async () => {
    vi.mocked(GET).mockResolvedValue(ok({ segments: [], truncated: false }));
    const { client, wrapper } = wrap();
    const { result } = renderHook(() => useSegmentsQuery("p1", true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      client.getQueryData(["projects", "p1", "segments", { archived: true }])
    ).toEqual({ segments: [], truncated: false });
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments?archived=true",
      expect.objectContaining({ maxRetries: 0 })
    );
  });

  it("keeps the catalogue fresh for ten minutes", async () => {
    vi.mocked(GET).mockResolvedValue(
      ok({ version: 1, limits: {}, conditions: [] })
    );
    const { client, wrapper } = wrap();
    const { result } = renderHook(() => useSegmentCatalogueQuery("p1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      (
        client
          .getQueryCache()
          .find({ queryKey: ["projects", "p1", "segmentCatalogue"] })
          ?.options as { staleTime?: number } | undefined
      )?.staleTime
    ).toBe(600_000);
  });

  it("pages members with the cursor the API returns", async () => {
    vi.mocked(POST)
      .mockResolvedValueOnce(
        ok({
          users: [{ id: "1" }],
          next_cursor: "c2",
          result_id: "r",
          persons: 2,
          devices: 2,
          incomplete: false,
        })
      )
      .mockResolvedValueOnce(
        ok({
          users: [{ id: "2" }],
          next_cursor: null,
          result_id: "r",
          persons: 2,
          devices: 2,
          incomplete: false,
        })
      );
    const { wrapper } = wrap();
    const { result } = renderHook(
      () => useSegmentMembersQuery("p1", "s1", "r"),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(POST).toHaveBeenLastCalledWith(
      "/api/v1/projects/p1/segments/s1/users",
      { cursor: "c2", limit: 50 },
      { maxRetries: 0 }
    );
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });

  it("polls exports only while one is pending", async () => {
    vi.mocked(GET).mockResolvedValue(
      ok({ exports: [{ id: "e1", status: "pending" }] })
    );
    const { client, wrapper } = wrap();
    const { result } = renderHook(() => useSegmentExportsQuery("p1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const query = client
      .getQueryCache()
      .find({ queryKey: ["projects", "p1", "segmentExports"] });
    const interval = (
      query?.options as { refetchInterval?: unknown } | undefined
    )?.refetchInterval as (q: unknown) => number | false;
    expect(interval({ state: { data: [{ status: "pending" }] } })).toBe(5_000);
    expect(interval({ state: { data: [{ status: "ready" }] } })).toBe(false);
  });

  it("debounces the estimate, skips invalid drafts and cancels superseded requests", async () => {
    vi.useFakeTimers();
    vi.mocked(POST).mockResolvedValue(
      ok({ persons: 3, devices: 4, approximate: false, incomplete: false })
    );
    const { result, rerender } = renderHook(
      ({ def, valid }: { def: typeof definition; valid: boolean }) =>
        useSegmentEstimate("p1", def, valid),
      { initialProps: { def: definition, valid: false } }
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(POST).not.toHaveBeenCalled();
    rerender({ def: definition, valid: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    rerender({ def: { ...definition, operator: "and" as const }, valid: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(POST).toHaveBeenCalledTimes(1);
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments/estimate",
      { definition: { ...definition, operator: "and" } },
      expect.objectContaining({ maxRetries: 0 })
    );
    expect(result.current.data?.persons).toBe(3);
  });

  it("waits for the in-flight estimate and then runs once with the latest draft", async () => {
    vi.useFakeTimers();
    let resolveFirst!: (v: ReturnType<typeof ok>) => void;
    vi.mocked(POST).mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolveFirst = r;
        })
    );
    vi.mocked(POST).mockResolvedValue(
      ok({ persons: 9, devices: 9, approximate: false, incomplete: false })
    );
    const { result, rerender } = renderHook(
      ({ def }: { def: typeof definition }) =>
        useSegmentEstimate("p1", def, true),
      { initialProps: { def: definition } }
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(POST).toHaveBeenCalledTimes(1);
    rerender({ def: { ...definition, operator: "and" as const } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(POST).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(true);
    await act(async () => {
      resolveFirst(
        ok({ persons: 1, devices: 1, approximate: false, incomplete: false })
      );
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(POST).toHaveBeenCalledTimes(2);
    expect(POST).toHaveBeenLastCalledWith(
      "/api/v1/projects/p1/segments/estimate",
      { definition: { ...definition, operator: "and" } },
      expect.objectContaining({ maxRetries: 0 })
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.data?.persons).toBe(9);
  });

  it("retries a busy estimate quietly before surfacing the error", async () => {
    vi.useFakeTimers();
    vi.mocked(POST).mockRejectedValueOnce(
      new ApiError("busy", 429, "segment_busy")
    );
    vi.mocked(POST).mockResolvedValue(
      ok({ persons: 5, devices: 5, approximate: false, incomplete: false })
    );
    const { result } = renderHook(() =>
      useSegmentEstimate("p1", definition, true)
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(result.current.pending).toBe(true);
    expect(result.current.error).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(POST).toHaveBeenCalledTimes(2);
    expect(result.current.data?.persons).toBe(5);
  });

  it("surfaces a ClickHouse outage immediately instead of retrying", async () => {
    vi.useFakeTimers();
    vi.mocked(POST).mockRejectedValue(
      new ApiError("down", 503, "clickhouse_unavailable")
    );
    const { result } = renderHook(() =>
      useSegmentEstimate("p1", definition, true)
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(result.current.pending).toBe(false);
    expect(result.current.error).toBeInstanceOf(ApiError);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(POST).toHaveBeenCalledTimes(1);
  });
});
