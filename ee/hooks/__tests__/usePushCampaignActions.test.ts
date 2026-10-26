import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { usePushCampaignActions } from "../usePushCampaignActions";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));

describe("usePushCampaignActions", () => {
  it("the cancel confirm says it is cancelling, not deleting", () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(() => usePushCampaignActions("p1", vi.fn()), {
      wrapper,
    });
    expect(result.current.cancelConfirm.pendingText).toBe("Cancelling...");
  });
});
