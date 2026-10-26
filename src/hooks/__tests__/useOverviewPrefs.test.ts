import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useOverviewPrefs } from "../useOverviewPrefs";

describe("useOverviewPrefs", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("loads empty prefs when nothing is stored", async () => {
    const { result } = renderHook(() => useOverviewPrefs("p1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.prefs).toEqual({});
  });

  it("remembers a patch and restores it for the same project on a fresh mount", async () => {
    const { result } = renderHook(() => useOverviewPrefs("p1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.remember({ metric: "installs", breakdown: "city" });
    });
    expect(result.current.prefs).toEqual({
      metric: "installs",
      breakdown: "city",
    });

    const { result: remounted } = renderHook(() => useOverviewPrefs("p1"));
    await waitFor(() => expect(remounted.current.loaded).toBe(true));
    expect(remounted.current.prefs).toEqual({
      metric: "installs",
      breakdown: "city",
    });
  });

  it("merges patches instead of replacing the whole object", async () => {
    const { result } = renderHook(() => useOverviewPrefs("p1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.remember({ metric: "installs" }));
    act(() => result.current.remember({ granularity: "week" }));

    expect(result.current.prefs).toEqual({
      metric: "installs",
      granularity: "week",
    });
  });

  it("keeps prefs scoped per project", async () => {
    const { result: p1 } = renderHook(() => useOverviewPrefs("p1"));
    await waitFor(() => expect(p1.current.loaded).toBe(true));
    act(() => p1.current.remember({ metric: "installs" }));

    const { result: p2 } = renderHook(() => useOverviewPrefs("p2"));
    await waitFor(() => expect(p2.current.loaded).toBe(true));
    expect(p2.current.prefs).toEqual({});
  });

  it("ignores a corrupt stored value", async () => {
    window.localStorage.setItem("overview:prefs:p1", "not json{{");
    const { result } = renderHook(() => useOverviewPrefs("p1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.prefs).toEqual({});
  });

  it("ignores a stored value that isn't a plain object", async () => {
    window.localStorage.setItem("overview:prefs:p1", JSON.stringify([1, 2, 3]));
    const { result } = renderHook(() => useOverviewPrefs("p1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.prefs).toEqual({});
  });

  it("survives a throwing localStorage on read", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useOverviewPrefs("p1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.prefs).toEqual({});
  });

  it("survives a throwing localStorage on write", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useOverviewPrefs("p1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(() => {
      act(() => result.current.remember({ metric: "installs" }));
    }).not.toThrow();
    expect(result.current.prefs).toEqual({ metric: "installs" });
  });

  it("does nothing without a projectId", () => {
    const { result } = renderHook(() => useOverviewPrefs(undefined));
    expect(result.current.loaded).toBe(false);
    act(() => result.current.remember({ metric: "installs" }));
    expect(result.current.prefs).toEqual({});
  });
});
