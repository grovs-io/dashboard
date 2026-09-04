import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSSOProvidersAPICall } from "@/api/auth/userService";
import { useSSOProviders } from "../useSSOProviders";

vi.mock("@/api/auth/userService", () => ({
  SSO_PROVIDERS: ["google_oauth2", "microsoft_graph"],
  fetchSSOProvidersAPICall: vi.fn(),
}));

const mockedFetchProviders = vi.mocked(fetchSSOProvidersAPICall);

describe("useSSOProviders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed while self-hosted provider discovery is pending", () => {
    mockedFetchProviders.mockReturnValueOnce(new Promise(() => {}));

    const { result } = renderHook(() => useSSOProviders(true));

    expect(result.current).toEqual([]);
  });

  it("shows only providers reported by the backend", async () => {
    mockedFetchProviders.mockResolvedValueOnce({
      data: {
        sso_enabled: true,
        providers: ["microsoft_graph"],
      },
    } as never);

    const { result } = renderHook(() => useSSOProviders(true));

    await waitFor(() => expect(result.current).toEqual(["microsoft_graph"]));
  });

  it("keeps local-only login when self-hosted discovery fails", async () => {
    mockedFetchProviders.mockRejectedValueOnce(new Error("unavailable"));

    const { result } = renderHook(() => useSSOProviders(true));

    await waitFor(() => expect(mockedFetchProviders).toHaveBeenCalledOnce());
    expect(result.current).toEqual([]);
  });

  it("preserves legacy SaaS buttons when discovery is unavailable", async () => {
    mockedFetchProviders.mockRejectedValueOnce(new Error("not supported"));

    const { result } = renderHook(() => useSSOProviders(false));

    await waitFor(() => expect(mockedFetchProviders).toHaveBeenCalledOnce());
    expect(result.current).toEqual(["google_oauth2", "microsoft_graph"]);
  });
});
