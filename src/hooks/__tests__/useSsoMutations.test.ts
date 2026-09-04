import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { queryKeys } from "@/lib/queryKeys";

vi.mock("@/api/sso/ssoService", () => ({
  upsertSsoConnectionAPICall: vi.fn(),
  deleteSsoConnectionAPICall: vi.fn(),
  verifySsoDomainsAPICall: vi.fn(),
  createScimTokenAPICall: vi.fn(),
  deleteScimTokenAPICall: vi.fn(),
}));

import {
  upsertSsoConnectionAPICall,
  createScimTokenAPICall,
} from "@/api/sso/ssoService";
import {
  useUpsertSsoConnectionMutation,
  useCreateScimTokenMutation,
} from "../mutations/useSsoMutations";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe("useSsoMutations", () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.clearAllMocks();
  });

  it("upsert invalidates the connection and the audit log", async () => {
    vi.mocked(upsertSsoConnectionAPICall).mockResolvedValue({
      data: { sso_connection: null },
    } as never);
    const { result } = renderHook(() => useUpsertSsoConnectionMutation("i1"), {
      wrapper: createWrapper(queryClient),
    });
    await act(async () => {
      await result.current.mutateAsync({ enforce: true });
    });
    expect(upsertSsoConnectionAPICall).toHaveBeenCalledWith("i1", {
      enforce: true,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.instances.ssoConnection("i1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.instances.auditEventsAll("i1"),
    });
  });

  it("token creation returns the plain token once", async () => {
    vi.mocked(createScimTokenAPICall).mockResolvedValue({
      data: { token: "scim_abc" },
    } as never);
    const { result } = renderHook(() => useCreateScimTokenMutation("i1"), {
      wrapper: createWrapper(queryClient),
    });
    let token = "";
    await act(async () => {
      token = (await result.current.mutateAsync()).data.token;
    });
    expect(token).toBe("scim_abc");
  });
});
