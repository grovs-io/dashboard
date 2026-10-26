import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AxiosHeaders } from "axios";
import { GET, POST } from "@/lib/api";
import {
  usePushCampaignQuery,
  usePushExperimentQuery,
  usePushCampaignsQuery,
  usePushDeliveriesQuery,
  useAudienceEstimate,
  usePushChannels,
  useRefreshDeliveriesWhileSending,
} from "../usePushQueries";
import { draftCampaign } from "@ee/components/push/composer/__tests__/helpers";
import type { PushCampaign } from "@ee/types/push";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));
vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({ selectedInstance: { id: "i1" } }),
}));

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

afterEach(() => {
  vi.clearAllMocks();
});

describe("usePushCampaignsQuery", () => {
  it("omits the status param for 'all' and includes it otherwise", async () => {
    vi.mocked(GET).mockResolvedValue(
      ok({ push_campaigns: [], truncated: false })
    );
    const { wrapper } = wrap();
    const { result, rerender } = renderHook(
      ({ status }: { status: "all" | "draft" }) =>
        usePushCampaignsQuery("p1", status),
      { wrapper, initialProps: { status: "all" } }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(GET).toHaveBeenLastCalledWith(
      "/api/v1/projects/p1/push_campaigns?limit=50",
      expect.objectContaining({ maxRetries: 0 })
    );

    rerender({ status: "draft" });
    await waitFor(() =>
      expect(GET).toHaveBeenLastCalledWith(
        "/api/v1/projects/p1/push_campaigns?status=draft&limit=50",
        expect.objectContaining({ maxRetries: 0 })
      )
    );
  });

  it("fetches the next page from next_after and stops when it is null", async () => {
    vi.mocked(GET)
      .mockResolvedValueOnce(
        ok({ push_campaigns: [], truncated: true, next_after: "k9Qx2" })
      )
      .mockResolvedValueOnce(
        ok({ push_campaigns: [], truncated: false, next_after: null })
      );
    const { wrapper } = wrap();
    const { result } = renderHook(() => usePushCampaignsQuery("p1", "all"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(() => result.current.fetchNextPage());
    expect(GET).toHaveBeenLastCalledWith(
      "/api/v1/projects/p1/push_campaigns?after=k9Qx2&limit=50",
      expect.objectContaining({ maxRetries: 0 })
    );
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });
});

describe("usePushCampaignQuery polling predicate", () => {
  it("polls every 3s while evaluating or sending, and stops otherwise", async () => {
    vi.mocked(GET).mockResolvedValue(
      ok({ push_campaign: { id: "c1", status: "draft" } })
    );
    const { client, wrapper } = wrap();
    const { result } = renderHook(() => usePushCampaignQuery("p1", "c1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const query = client
      .getQueryCache()
      .find({ queryKey: ["projects", "p1", "pushCampaign", "c1"] });
    const interval = (
      query?.options as { refetchInterval?: unknown } | undefined
    )?.refetchInterval as (q: {
      state: { data?: { status?: string } };
    }) => number | false;

    expect(interval({ state: { data: { status: "evaluating" } } })).toBe(3_000);
    expect(interval({ state: { data: { status: "sending" } } })).toBe(3_000);
    expect(interval({ state: { data: { status: "draft" } } })).toBe(false);
    expect(interval({ state: { data: { status: "sent" } } })).toBe(false);
    expect(interval({ state: { data: undefined } })).toBe(false);
    // The rest waiting for a winner: the timer may send it any time.
    const waiting = { status: "sent", report: { waiting: 5 }, winner: null };
    expect(interval({ state: { data: waiting as never } })).toBe(30_000);
    expect(
      interval({ state: { data: { ...waiting, winner: "b" } as never } })
    ).toBe(false);
  });
});

describe("usePushExperimentQuery", () => {
  it("asks again every 30 s only while told to", async () => {
    vi.mocked(GET).mockResolvedValue(ok({ experiment: { groups: [] } }));
    const { client, wrapper } = wrap();
    const { result } = renderHook(
      () => usePushExperimentQuery("p1", "c1", true, true),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const query = client
      .getQueryCache()
      .find({ queryKey: ["projects", "p1", "pushExperiment", "c1"] });
    expect(
      (query?.options as { refetchInterval?: unknown })?.refetchInterval
    ).toBe(30_000);
  });
});

describe("usePushDeliveriesQuery", () => {
  it("threads next_after as the cursor for the following page", async () => {
    vi.mocked(GET)
      .mockResolvedValueOnce(ok({ deliveries: [{ id: 1 }], next_after: 1 }))
      .mockResolvedValueOnce(ok({ deliveries: [{ id: 2 }], next_after: null }));
    const { wrapper } = wrap();
    const { result } = renderHook(() => usePushDeliveriesQuery("p1", "c1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(GET).toHaveBeenLastCalledWith(
      "/api/v1/projects/p1/push_campaigns/c1/deliveries?after=0&limit=50",
      expect.objectContaining({ maxRetries: 0 })
    );
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(GET).toHaveBeenLastCalledWith(
      "/api/v1/projects/p1/push_campaigns/c1/deliveries?after=1&limit=50",
      expect.objectContaining({ maxRetries: 0 })
    );
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });
});

const ESTIMATE = {
  devices: 10,
  no_channel: 1,
  not_found: 0,
  no_app: 0,
  reachable: 9,
  platforms: {
    ios: { devices: 9, configured: true },
    android: { devices: 0, configured: true },
  },
};

describe("useAudienceEstimate", () => {
  it("estimates after the debounce and reports data", async () => {
    vi.mocked(POST).mockResolvedValueOnce(ok(ESTIMATE));
    const { wrapper } = wrap();
    const audience = { type: "identifiers" as const, recipients: ["u1"] };
    const { result } = renderHook(
      () => useAudienceEstimate("p1", audience, 10),
      { wrapper }
    );
    expect(result.current.pending).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual(ESTIMATE));
    expect(result.current.pending).toBe(false);
  });

  it("captures a rejected estimate as an ApiError and retries on demand", async () => {
    const { ApiError } = await import("@/lib/ApiError");
    vi.mocked(POST)
      .mockRejectedValueOnce(new ApiError("busy", 429, "segment_busy"))
      .mockResolvedValueOnce(ok({ devices: 2, no_channel: 0, not_found: 0 }));
    const { wrapper } = wrap();
    const audience = { type: "identifiers" as const, recipients: ["u1"] };
    const { result } = renderHook(
      () => useAudienceEstimate("p1", audience, 10),
      { wrapper }
    );
    await waitFor(() =>
      expect(result.current.error?.code).toBe("segment_busy")
    );
    expect(result.current.pending).toBe(false);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.data?.devices).toBe(2));
    expect(result.current.error).toBeNull();
    expect(POST).toHaveBeenCalledTimes(2);
  });

  it("is idle without an audience", () => {
    const { wrapper } = wrap();
    const { result } = renderHook(() => useAudienceEstimate("p1", null), {
      wrapper,
    });
    expect(result.current).toMatchObject({
      data: null,
      error: null,
      pending: false,
    });
    expect(POST).not.toHaveBeenCalled();
  });
});

describe("useRefreshDeliveriesWhileSending", () => {
  const deliveriesKey = ["projects", "p1", "pushDeliveries", "k9Qx2"];
  const at = (status: PushCampaign["status"], delivered: number) => {
    const c = draftCampaign({ status });
    return { ...c, report: { ...c.report, delivered } };
  };

  it("refreshes deliveries on new counters while sending, and stops after", () => {
    const { client, wrapper } = wrap();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const calls = () =>
      invalidate.mock.calls.filter(
        ([f]) => JSON.stringify(f?.queryKey) === JSON.stringify(deliveriesKey)
      ).length;
    const { rerender } = renderHook(
      ({ campaign }: { campaign: PushCampaign }) =>
        useRefreshDeliveriesWhileSending("p1", campaign),
      { wrapper, initialProps: { campaign: at("sending", 0) } }
    );
    expect(calls()).toBe(0);

    rerender({ campaign: at("sending", 0) });
    expect(calls()).toBe(0);
    rerender({ campaign: at("sending", 5) });
    expect(calls()).toBe(1);
    rerender({ campaign: at("sent", 9) });
    expect(calls()).toBe(2);
    rerender({ campaign: at("sent", 10) });
    expect(calls()).toBe(2);
  });

  it("never refreshes for a campaign that is not sending", () => {
    const { client, wrapper } = wrap();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { rerender } = renderHook(
      ({ campaign }: { campaign: PushCampaign }) =>
        useRefreshDeliveriesWhileSending("p1", campaign),
      { wrapper, initialProps: { campaign: at("sent", 1) } }
    );
    rerender({ campaign: at("sent", 2) });
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("usePushChannels", () => {
  it("is undefined while loading, then the configured channels", async () => {
    let resolve: (value: unknown) => void = () => {};
    vi.mocked(GET).mockImplementation(
      () => new Promise((r) => (resolve = r)) as never
    );
    const { wrapper } = wrap();
    const { result } = renderHook(() => usePushChannels(), { wrapper });
    expect(result.current).toBeUndefined();
    resolve(
      ok({
        configurations: [
          {
            platform: "android",
            configuration: { push_configuration: { firebase_project_id: "x" } },
          },
        ],
      })
    );
    await waitFor(() =>
      expect(result.current).toEqual({ ios: false, android: true })
    );
  });

  it("is null when the configurations fail to load", async () => {
    vi.mocked(GET).mockRejectedValue(new Error("boom"));
    const { wrapper } = wrap();
    const { result } = renderHook(() => usePushChannels(), { wrapper });
    await waitFor(() => expect(GET).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current).toBeNull();
  });

  it("drops the last known channels when a refetch fails", async () => {
    vi.mocked(GET).mockResolvedValue(
      ok({
        configurations: [
          {
            platform: "android",
            configuration: { push_configuration: { firebase_project_id: "x" } },
          },
        ],
      })
    );
    const { client, wrapper } = wrap();
    const { result } = renderHook(() => usePushChannels(), { wrapper });
    await waitFor(() =>
      expect(result.current).toEqual({ ios: false, android: true })
    );
    vi.mocked(GET).mockRejectedValue(new Error("boom"));
    await act(() => client.refetchQueries());
    await waitFor(() => expect(result.current).toBeNull());
  });
});
