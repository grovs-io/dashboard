import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AxiosHeaders } from "axios";
import { GET } from "@/lib/api";
import { useEventDestinations } from "../useEventStreamQueries";
import { destination } from "@ee/components/event-stream/__tests__/fixtures";
vi.mock("@/lib/api", () => ({ GET: vi.fn() }));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));

afterEach(() => {
  vi.useRealTimers();
  focusManager.setFocused(undefined);
  vi.clearAllMocks();
});
describe("destination health polling", () => {
  it("updates visible health every 30 seconds and stops polling in a hidden tab", async () => {
    vi.useFakeTimers();
    focusManager.setFocused(true);
    let delivered = 120;
    vi.mocked(GET).mockImplementation(async () => ({
      data: {
        event_destinations: [destination({ delivered_count: delivered })],
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: new AxiosHeaders() },
    }));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useEventDestinations("p1"), {
      wrapper,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.data?.[0]?.delivered_count).toBe(120);
    delivered = 135;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_010);
    });
    expect(result.current.data?.[0]?.delivered_count).toBe(135);
    const reads = vi.mocked(GET).mock.calls.length;
    focusManager.setFocused(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(GET).toHaveBeenCalledTimes(reads);
    unmount();
    client.clear();
  });
});
