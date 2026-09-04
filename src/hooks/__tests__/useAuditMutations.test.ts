import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { queryKeys } from "@/lib/queryKeys";

vi.mock("@/api/audit/auditService", () => ({
  createAuditExportTokenAPICall: vi.fn(),
  revokeAuditExportTokenAPICall: vi.fn(),
}));

import {
  createAuditExportTokenAPICall,
  revokeAuditExportTokenAPICall,
} from "@/api/audit/auditService";
import {
  useCreateAuditExportTokenMutation,
  useRevokeAuditExportTokenMutation,
} from "../mutations/useAuditMutations";

const mockedCreate = vi.mocked(createAuditExportTokenAPICall);
const mockedRevoke = vi.mocked(revokeAuditExportTokenAPICall);

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe("useAuditMutations", () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: Infinity,
        },
        mutations: {
          retry: false,
        },
      },
    });
    invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.clearAllMocks();
  });

  it("creates a token and invalidates tokens + events", async () => {
    const eventsNoFilter = [
      ...queryKeys.instances.auditEvents("i1", {}),
      "infinite",
    ];
    const eventsFiltered = [
      ...queryKeys.instances.auditEvents("i1", {
        event_action: "link.created",
      }),
      "infinite",
    ];
    const tokensKey = queryKeys.instances.auditExportTokens("i1");
    const headKey = queryKeys.instances.auditHead("i1");

    queryClient.setQueryData(eventsNoFilter, { pages: [], pageParams: [] });
    queryClient.setQueryData(eventsFiltered, { pages: [], pageParams: [] });
    queryClient.setQueryData(tokensKey, []);
    queryClient.setQueryData(headKey, {
      schema_version: 1,
      sequence: 1,
      hash: null,
    });

    mockedCreate.mockResolvedValueOnce({
      data: {
        audit_export_token: {
          id: "t1",
          name: "Splunk",
          created_at: "2026-08-01T00:00:00Z",
          last_used_at: null,
          created_by_email: "a@b.c",
        },
        token: "aet_secret",
      },
    } as never);

    const { result } = renderHook(
      () => useCreateAuditExportTokenMutation("i1"),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      const res = await result.current.mutateAsync({ name: "Splunk" });
      expect(res.data.token).toBe("aet_secret");
    });

    expect(mockedCreate).toHaveBeenCalledWith("i1", { name: "Splunk" });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.instances.auditExportTokens("i1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.instances.auditEventsAll("i1"),
    });
    expect(queryClient.getQueryState(eventsNoFilter)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(eventsFiltered)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(tokensKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(headKey)?.isInvalidated).toBe(true);
  });

  it("revokes a token and invalidates tokens + events", async () => {
    const eventsNoFilter = [
      ...queryKeys.instances.auditEvents("i1", {}),
      "infinite",
    ];
    const eventsFiltered = [
      ...queryKeys.instances.auditEvents("i1", {
        event_action: "link.created",
      }),
      "infinite",
    ];
    const tokensKey = queryKeys.instances.auditExportTokens("i1");
    const headKey = queryKeys.instances.auditHead("i1");

    queryClient.setQueryData(eventsNoFilter, { pages: [], pageParams: [] });
    queryClient.setQueryData(eventsFiltered, { pages: [], pageParams: [] });
    queryClient.setQueryData(tokensKey, []);
    queryClient.setQueryData(headKey, {
      schema_version: 1,
      sequence: 1,
      hash: null,
    });

    mockedRevoke.mockResolvedValueOnce({
      data: { message: "Token revoked" },
    } as never);

    const { result } = renderHook(
      () => useRevokeAuditExportTokenMutation("i1"),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await result.current.mutateAsync("t1");
    });

    expect(mockedRevoke).toHaveBeenCalledWith("i1", "t1");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.instances.auditExportTokens("i1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.instances.auditEventsAll("i1"),
    });
    expect(queryClient.getQueryState(eventsNoFilter)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(eventsFiltered)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(tokensKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(headKey)?.isInvalidated).toBe(true);
  });
});
