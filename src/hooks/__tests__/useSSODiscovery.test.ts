import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/api/sso/ssoService", () => ({ discoverSsoAPICall: vi.fn() }));

import { discoverSsoAPICall } from "@/api/sso/ssoService";
import { useSSODiscovery } from "../useSSODiscovery";

const mocked = vi.mocked(discoverSsoAPICall);

describe("useSSODiscovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  it("does not call discover for a partial email", () => {
    renderHook(() => useSSODiscovery("alice@"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mocked).not.toHaveBeenCalled();
  });

  it("debounces and returns the connection", async () => {
    mocked.mockResolvedValue({
      data: { connection_id: 12, enforce: true },
    } as never);
    const { result } = renderHook(() => useSSODiscovery("alice@uhc.com"));
    expect(mocked).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });
    expect(mocked).toHaveBeenCalledWith("alice@uhc.com");
    expect(result.current).toEqual({ connectionId: 12, enforce: true });
  });

  it("treats a failed discover as no SSO", async () => {
    mocked.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useSSODiscovery("bob@acme.com"));
    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current).toEqual({ connectionId: null, enforce: false });
  });
});
