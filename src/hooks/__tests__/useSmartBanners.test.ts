import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { queryKeys } from "@/lib/queryKeys";
import {
  useSmartBannerQuery,
  useSmartBannersQuery,
} from "../queries/useSmartBannersQueries";
import {
  useCreateSmartBannerMutation,
  useDeleteSmartBannerMutation,
  useDuplicateSmartBannerMutation,
  useReorderSmartBannersMutation,
  useUpdateSmartBannerMutation,
} from "../mutations/useSmartBannersMutations";

vi.mock("@/api/smartBanners/smartBannersService", () => ({
  getSmartBannersAPICall: vi.fn(),
  getSmartBannerAPICall: vi.fn(),
  createSmartBannerAPICall: vi.fn(),
  updateSmartBannerAPICall: vi.fn(),
  deleteSmartBannerAPICall: vi.fn(),
  duplicateSmartBannerAPICall: vi.fn(),
  reorderSmartBannersAPICall: vi.fn(),
}));

import {
  getSmartBannersAPICall,
  getSmartBannerAPICall,
  createSmartBannerAPICall,
  updateSmartBannerAPICall,
  deleteSmartBannerAPICall,
  duplicateSmartBannerAPICall,
  reorderSmartBannersAPICall,
} from "@/api/smartBanners/smartBannersService";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, children);

const b = (id: number, status = "live", priority = id) => ({
  id,
  name: `B${id}`,
  status,
  priority,
});
const listKey = queryKeys.projects.smartBanners("p1");

beforeEach(() => {
  vi.clearAllMocks();
  // Not createTestQueryClient: its gcTime 0 would drop seeded caches before a mutation settles.
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
});

describe("useSmartBannersQuery", () => {
  it("returns the banner list", async () => {
    vi.mocked(getSmartBannersAPICall).mockResolvedValue({
      data: { smart_banners: [b(1)] },
    } as never);
    const { result } = renderHook(() => useSmartBannersQuery("p1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([b(1)]);
    expect(getSmartBannersAPICall).toHaveBeenCalledWith("p1");
  });

  it("does not fetch without a project", () => {
    renderHook(() => useSmartBannersQuery(undefined), { wrapper });
    expect(getSmartBannersAPICall).not.toHaveBeenCalled();
  });
});

describe("useSmartBannerQuery", () => {
  it("refetches on mount even when a cached copy exists", async () => {
    client.setQueryData(queryKeys.projects.smartBanner("p1", 1), b(1));
    vi.mocked(getSmartBannerAPICall).mockResolvedValue({
      data: { smart_banner: b(1, "paused") },
    } as never);
    const { result } = renderHook(() => useSmartBannerQuery("p1", 1), {
      wrapper,
    });
    expect(result.current.isFetchedAfterMount).toBe(false);
    await waitFor(() => expect(result.current.isFetchedAfterMount).toBe(true));
    expect(result.current.data).toEqual(b(1, "paused"));
  });
});

describe("mutations", () => {
  it("create invalidates the list", async () => {
    vi.mocked(createSmartBannerAPICall).mockResolvedValue({
      data: { smart_banner: b(2) },
    } as never);
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateSmartBannerMutation("p1"), {
      wrapper,
    });
    const fd = new FormData();
    await act(async () => {
      expect(await result.current.mutateAsync(fd)).toEqual(b(2));
    });
    expect(createSmartBannerAPICall).toHaveBeenCalledWith("p1", fd);
    expect(spy).toHaveBeenCalledWith({ queryKey: listKey });
  });

  it("create resolves without waiting for the list refetch, so the dialog can close right away", async () => {
    vi.mocked(createSmartBannerAPICall).mockResolvedValue({
      data: { smart_banner: b(2) },
    } as never);
    let resolveInvalidate!: (v?: unknown) => void;
    vi.spyOn(client, "invalidateQueries").mockReturnValue(
      new Promise((r) => (resolveInvalidate = r)) as never
    );
    const { result } = renderHook(() => useCreateSmartBannerMutation("p1"), {
      wrapper,
    });
    const fd = new FormData();
    // Resolves even though the invalidation's own promise is still pending.
    await act(async () => {
      expect(await result.current.mutateAsync(fd)).toEqual(b(2));
    });
    resolveInvalidate();
  });

  it("update writes the returned banner into the list and detail caches without refetching", async () => {
    client.setQueryData(listKey, [b(1), b(3)]);
    vi.mocked(updateSmartBannerAPICall).mockResolvedValue({
      data: { smart_banner: b(3, "paused") },
    } as never);
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUpdateSmartBannerMutation("p1"), {
      wrapper,
    });
    const fd = new FormData();
    await act(async () => {
      await result.current.mutateAsync({ id: 3, fd });
    });
    expect(updateSmartBannerAPICall).toHaveBeenCalledWith("p1", 3, fd);
    expect(client.getQueryData(listKey)).toEqual([b(1), b(3, "paused")]);
    expect(
      client.getQueryData(queryKeys.projects.smartBanner("p1", 3))
    ).toEqual(b(3, "paused"));
    expect(spy).not.toHaveBeenCalled();
  });

  it("update re-sorts the list by priority, so a restore moves the banner to the end", async () => {
    client.setQueryData(listKey, [
      b(1, "live", 0),
      b(2, "archived", 1),
      b(3, "live", 2),
    ]);
    // Restoring sets status to paused and moves it to the last priority server-side.
    vi.mocked(updateSmartBannerAPICall).mockResolvedValue({
      data: { smart_banner: b(2, "paused", 3) },
    } as never);
    const { result } = renderHook(() => useUpdateSmartBannerMutation("p1"), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync({ id: 2, fd: new FormData() });
    });
    expect(client.getQueryData(listKey)).toEqual([
      b(1, "live", 0),
      b(3, "live", 2),
      b(2, "paused", 3),
    ]);
  });

  it("delete removes the banner from the list cache", async () => {
    client.setQueryData(listKey, [b(1), b(4)]);
    vi.mocked(deleteSmartBannerAPICall).mockResolvedValue({
      data: {},
    } as never);
    const { result } = renderHook(() => useDeleteSmartBannerMutation("p1"), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync(4);
    });
    expect(deleteSmartBannerAPICall).toHaveBeenCalledWith("p1", 4);
    expect(client.getQueryData(listKey)).toEqual([b(1)]);
  });

  it("reorder updates the cache before the request returns and keeps the server list", async () => {
    client.setQueryData(listKey, [b(1), b(2)]);
    let resolve!: (v: unknown) => void;
    vi.mocked(reorderSmartBannersAPICall).mockReturnValue(
      new Promise((r) => (resolve = r)) as never
    );
    const { result } = renderHook(() => useReorderSmartBannersMutation("p1"), {
      wrapper,
    });
    let done!: Promise<unknown>;
    act(() => {
      done = result.current.mutateAsync([2, 1]);
    });
    // Optimistic entries carry their new index as priority, not the old one.
    await waitFor(() =>
      expect(client.getQueryData(listKey)).toEqual([
        b(2, "live", 0),
        b(1, "live", 1),
      ])
    );
    await act(async () => {
      resolve({ data: { smart_banners: [b(2), b(1)] } });
      await done;
    });
    expect(reorderSmartBannersAPICall).toHaveBeenCalledWith("p1", [2, 1]);
    expect(client.getQueryData(listKey)).toEqual([b(2), b(1)]);
  });

  it("reorder rewrites priority to the new index, so a concurrent update's re-sort can't flicker it back", async () => {
    client.setQueryData(listKey, [
      b(1, "live", 0),
      b(2, "live", 1),
      b(3, "live", 2),
    ]);
    let resolve!: (v: unknown) => void;
    vi.mocked(reorderSmartBannersAPICall).mockReturnValue(
      new Promise((r) => (resolve = r)) as never
    );
    const { result } = renderHook(() => useReorderSmartBannersMutation("p1"), {
      wrapper,
    });
    let done!: Promise<unknown>;
    act(() => {
      done = result.current.mutateAsync([3, 1, 2]);
    });
    await waitFor(() =>
      expect(client.getQueryData(listKey)).toEqual([
        b(3, "live", 0),
        b(1, "live", 1),
        b(2, "live", 2),
      ])
    );
    await act(async () => {
      resolve({
        data: {
          smart_banners: [b(3, "live", 0), b(1, "live", 1), b(2, "live", 2)],
        },
      });
      await done;
    });
  });

  it("reorder restores the previous order on error", async () => {
    client.setQueryData(listKey, [b(1), b(2)]);
    vi.mocked(reorderSmartBannersAPICall).mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useReorderSmartBannersMutation("p1"), {
      wrapper,
    });
    await act(async () => {
      await expect(result.current.mutateAsync([2, 1])).rejects.toThrow("boom");
    });
    expect(client.getQueryData(listKey)).toEqual([b(1), b(2)]);
  });

  it("reorder invalidates the list on error so a stale id list (422) refetches", async () => {
    client.setQueryData(listKey, [b(1), b(2)]);
    vi.mocked(reorderSmartBannersAPICall).mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useReorderSmartBannersMutation("p1"), {
      wrapper,
    });
    await act(async () => {
      await expect(result.current.mutateAsync([2, 1])).rejects.toThrow("boom");
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: listKey });
  });

  it("duplicate invalidates the list and returns the copy", async () => {
    vi.mocked(duplicateSmartBannerAPICall).mockResolvedValue({
      data: { smart_banner: b(9, "draft") },
    } as never);
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useDuplicateSmartBannerMutation("p1"), {
      wrapper,
    });
    await act(async () => {
      expect(await result.current.mutateAsync(1)).toEqual(b(9, "draft"));
    });
    expect(duplicateSmartBannerAPICall).toHaveBeenCalledWith("p1", 1);
    expect(spy).toHaveBeenCalledWith({ queryKey: listKey });
  });

  it("duplicate resolves without waiting for the list refetch", async () => {
    vi.mocked(duplicateSmartBannerAPICall).mockResolvedValue({
      data: { smart_banner: b(9, "draft") },
    } as never);
    let resolveInvalidate!: (v?: unknown) => void;
    vi.spyOn(client, "invalidateQueries").mockReturnValue(
      new Promise((r) => (resolveInvalidate = r)) as never
    );
    const { result } = renderHook(() => useDuplicateSmartBannerMutation("p1"), {
      wrapper,
    });
    await act(async () => {
      expect(await result.current.mutateAsync(1)).toEqual(b(9, "draft"));
    });
    resolveInvalidate();
  });

  it("reorder keeps archived banners the ids leave out", async () => {
    client.setQueryData(listKey, [b(1), b(2), b(5, "archived")]);
    vi.mocked(reorderSmartBannersAPICall).mockResolvedValue({
      data: { smart_banners: [b(2), b(1)] },
    } as never);
    const { result } = renderHook(() => useReorderSmartBannersMutation("p1"), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync([2, 1]);
    });
    expect(client.getQueryData(listKey)).toEqual([
      b(2),
      b(1),
      b(5, "archived"),
    ]);
  });

  it("rejects without a project", async () => {
    const { result } = renderHook(
      () => useDeleteSmartBannerMutation(undefined),
      { wrapper }
    );
    await expect(result.current.mutateAsync(1)).rejects.toThrow(
      "No project selected"
    );
  });
});
