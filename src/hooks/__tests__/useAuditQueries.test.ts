import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { createTestQueryClient } from "./query-test-utils";

const editionState = vi.hoisted(() => ({ selfHosted: false }));
vi.mock("@/lib/edition", () => ({
  get IS_SELF_HOSTED() {
    return editionState.selfHosted;
  },
  IS_ENTERPRISE: true,
}));

vi.mock("@/hooks/queries/usePaymentsQueries", () => ({
  useSubscriptionQuery: vi.fn(),
}));

const adminState = { isAdmin: true };
vi.mock("@/hooks/useIsInstanceAdmin", () => ({
  useIsInstanceAdmin: () => adminState.isAdmin,
}));

vi.mock("@/api/audit/auditService", () => ({
  getAuditHeadAPICall: vi.fn(),
  getAuditEventsAPICall: vi.fn(),
  listAuditExportTokensAPICall: vi.fn(),
}));

import { useSubscriptionQuery } from "@/hooks/queries/usePaymentsQueries";
import {
  getAuditHeadAPICall,
  getAuditEventsAPICall,
  listAuditExportTokensAPICall,
} from "@/api/audit/auditService";
import {
  normalizeAuditFilters,
  useAuditLogEnabled,
  useAuditLogAccess,
  useAuditHeadQuery,
  useAuditEventsInfiniteQuery,
  useAuditExportTokensQuery,
} from "../queries/useAuditQueries";

const mockedSubscription = vi.mocked(useSubscriptionQuery);
const mockedHead = vi.mocked(getAuditHeadAPICall);
const mockedEvents = vi.mocked(getAuditEventsAPICall);
const mockedTokens = vi.mocked(listAuditExportTokensAPICall);

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

const event = (sequence: number) => ({
  id: sequence,
  sequence,
  occurred_at: "2026-08-28T10:00:00.000000Z",
  action: "link.created",
  outcome: "success",
  actor: { type: "user", id: 1, email: "a@b.c", via: "dashboard" },
  target: {},
  changes: {},
  ip: null,
  user_agent: null,
  request_id: null,
  prev_hash: null,
  hash: "h",
});

describe("useAuditQueries", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    editionState.selfHosted = false;
    mockedSubscription.mockReturnValue({
      data: { subscription: null, isEnterprise: false },
      isLoading: false,
    } as never);
  });

  describe("normalizeAuditFilters", () => {
    it("drops empty and undefined values", () => {
      expect(
        normalizeAuditFilters({
          event_action: "",
          actor_email: "a@b.c",
          from: undefined,
          to: "2026-01-01T00:00:00.000Z",
        })
      ).toEqual({ actor_email: "a@b.c", to: "2026-01-01T00:00:00.000Z" });
    });

    it("returns an empty object when nothing is set", () => {
      expect(normalizeAuditFilters({ event_action: "" })).toEqual({});
    });
  });

  describe("useAuditLogEnabled", () => {
    it("is true on self-hosted regardless of subscription", () => {
      editionState.selfHosted = true;
      const { result } = renderHook(() => useAuditLogEnabled("i1"), {
        wrapper: createWrapper(queryClient),
      });
      expect(result.current).toBe(true);
    });

    it("is true for an enterprise subscription", () => {
      mockedSubscription.mockReturnValue({
        data: { subscription: {}, isEnterprise: true },
        isLoading: false,
      } as never);
      const { result } = renderHook(() => useAuditLogEnabled("i1"), {
        wrapper: createWrapper(queryClient),
      });
      expect(result.current).toBe(true);
    });

    it("is false for a non-enterprise SaaS instance", () => {
      const { result } = renderHook(() => useAuditLogEnabled("i1"), {
        wrapper: createWrapper(queryClient),
      });
      expect(result.current).toBe(false);
    });

    it("is false while the subscription is still loading", () => {
      mockedSubscription.mockReturnValue({
        data: undefined,
        isLoading: true,
      } as never);
      const { result } = renderHook(() => useAuditLogEnabled("i1"), {
        wrapper: createWrapper(queryClient),
      });
      expect(result.current).toBe(false);
    });
  });

  describe("useAuditLogAccess", () => {
    beforeEach(() => {
      mockedSubscription.mockReturnValue({
        data: { subscription: {}, isEnterprise: true },
        isLoading: false,
        isPending: false,
      } as never);
      adminState.isAdmin = true;
    });

    it("allows an admin on an entitled instance", () => {
      const { result } = renderHook(() => useAuditLogAccess("i1"), {
        wrapper: createWrapper(queryClient),
      });
      expect(result.current).toEqual({ allowed: true, isResolving: false });
    });

    it("denies a non-admin on an entitled instance", () => {
      adminState.isAdmin = false;
      const { result } = renderHook(() => useAuditLogAccess("i1"), {
        wrapper: createWrapper(queryClient),
      });
      expect(result.current.allowed).toBe(false);
    });

    it("denies an admin on a non-entitled instance", () => {
      mockedSubscription.mockReturnValue({
        data: { subscription: null, isEnterprise: false },
        isLoading: false,
        isPending: false,
      } as never);
      const { result } = renderHook(() => useAuditLogAccess("i1"), {
        wrapper: createWrapper(queryClient),
      });
      expect(result.current.allowed).toBe(false);
    });

    it("reports isResolving while entitlement is pending", () => {
      mockedSubscription.mockReturnValue({
        data: undefined,
        isLoading: true,
        isPending: true,
      } as never);
      const { result } = renderHook(() => useAuditLogAccess("i1"), {
        wrapper: createWrapper(queryClient),
      });
      expect(result.current).toEqual({ allowed: false, isResolving: true });
    });

    it("is not resolving without a selected instance", () => {
      const { result } = renderHook(() => useAuditLogAccess(undefined), {
        wrapper: createWrapper(queryClient),
      });
      expect(result.current).toEqual({ allowed: false, isResolving: false });
    });
  });

  describe("useAuditHeadQuery", () => {
    it("returns the head payload", async () => {
      mockedHead.mockResolvedValueOnce({
        data: { schema_version: 1, sequence: 1234, hash: "abc" },
      } as never);
      const { result } = renderHook(() => useAuditHeadQuery("i1", true), {
        wrapper: createWrapper(queryClient),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.sequence).toBe(1234);
    });

    it("does not fetch when disabled", () => {
      renderHook(() => useAuditHeadQuery("i1", false), {
        wrapper: createWrapper(queryClient),
      });
      expect(mockedHead).not.toHaveBeenCalled();
    });
  });

  describe("useAuditEventsInfiniteQuery", () => {
    it("requests newest-first pages and cursors on next_before", async () => {
      mockedEvents
        .mockResolvedValueOnce({
          data: {
            schema_version: 1,
            events: [event(100), event(99)],
            next_after: 100,
            next_before: 99,
          },
        } as never)
        .mockResolvedValueOnce({
          data: {
            schema_version: 1,
            events: [event(98)],
            next_after: 98,
            next_before: 98,
          },
        } as never);

      const { result, rerender } = renderHook(
        () =>
          useAuditEventsInfiniteQuery("i1", { event_action: "link.created" }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockedEvents).toHaveBeenNthCalledWith(1, "i1", {
        order: "desc",
        limit: 50,
        before: undefined,
        event_action: "link.created",
      });
      expect(result.current.hasNextPage).toBe(true);

      await act(async () => {
        await result.current.fetchNextPage();
      });
      // The observer's cache update can land without the subscriber
      // notification flushing a re-render in this test environment; force
      // one so `result.current` reflects the now-current query state.
      act(() => {
        rerender();
      });

      expect(mockedEvents).toHaveBeenNthCalledWith(2, "i1", {
        order: "desc",
        limit: 50,
        before: 99,
        event_action: "link.created",
      });
      expect(result.current.data?.pages).toHaveLength(2);
    });

    it("stops paging when a page has no events", async () => {
      mockedEvents.mockResolvedValueOnce({
        data: {
          schema_version: 1,
          events: [],
          next_after: null,
          next_before: null,
        },
      } as never);

      const { result } = renderHook(() => useAuditEventsInfiniteQuery("i1"), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.hasNextPage).toBe(false);
    });

    it("does not fetch when disabled or without an instance", () => {
      renderHook(() => useAuditEventsInfiniteQuery("i1", {}, false), {
        wrapper: createWrapper(queryClient),
      });
      renderHook(() => useAuditEventsInfiniteQuery(undefined), {
        wrapper: createWrapper(queryClient),
      });
      expect(mockedEvents).not.toHaveBeenCalled();
    });
  });

  describe("useAuditExportTokensQuery", () => {
    it("returns the tokens array", async () => {
      mockedTokens.mockResolvedValueOnce({
        data: {
          audit_export_tokens: [
            {
              id: "t1",
              name: "Splunk",
              created_at: "2026-08-01T00:00:00Z",
              last_used_at: null,
              created_by_email: "a@b.c",
            },
          ],
        },
      } as never);
      const { result } = renderHook(
        () => useAuditExportTokensQuery("i1", true),
        { wrapper: createWrapper(queryClient) }
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.[0]?.name).toBe("Splunk");
    });
  });
});
