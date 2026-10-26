import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { createTestQueryClient } from "./query-test-utils";

vi.mock("@/lib/api", () => ({ GET: vi.fn() }));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));
import { GET } from "@/lib/api";
import { useSdkStatusQuery } from "../queries/useSdkStatusQuery";

const status = {
  ios_seen_at: null,
  android_seen_at: null,
  web_seen_at: null,
  has_events: false,
  has_purchases: false,
  has_links: false,
};

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client: createTestQueryClient() },
    children
  );
}

describe("useSdkStatusQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the project's sdk_status without retries", async () => {
    vi.mocked(GET).mockResolvedValue({ data: status } as never);
    const { result } = renderHook(() => useSdkStatusQuery("p1"), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(status));
    expect(GET).toHaveBeenCalledWith("/api/v1/projects/p1/sdk_status", {
      maxRetries: 0,
    });
  });

  it("leaves data undefined on a 404 so the dashboard shows", async () => {
    vi.mocked(GET).mockRejectedValue(
      Object.assign(new Error("Not found"), { status: 404 })
    );
    const { result } = renderHook(() => useSdkStatusQuery("p1", "events"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(GET).toHaveBeenCalledTimes(1);
  });

  it("polls at the given refetchInterval", async () => {
    vi.mocked(GET).mockResolvedValue({ data: status } as never);
    renderHook(() => useSdkStatusQuery("p1", null, { refetchInterval: 20 }), {
      wrapper,
    });
    await waitFor(() => expect(GET).toHaveBeenCalledTimes(3));
  });

  it("does nothing without a project", () => {
    renderHook(() => useSdkStatusQuery(undefined), { wrapper });
    expect(GET).not.toHaveBeenCalled();
  });
});
