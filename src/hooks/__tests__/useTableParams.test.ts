import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Writes go through history.replaceState, so assert the resulting URL, not a router call.
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

import { useTableParams } from "../useTableParams";

const currentUrl = () => window.location.pathname + window.location.search;

// Point both the mocked useSearchParams and the real URL at the same query string.
const setUrl = (qs: string) => {
  mockSearchParams = new URLSearchParams(qs);
  window.history.replaceState(null, "", qs ? `/test-path?${qs}` : "/test-path");
};

describe("useTableParams", () => {
  beforeEach(() => {
    setUrl("");
  });

  describe("defaults", () => {
    it("returns correct default values when no URL params are set", () => {
      const { result } = renderHook(() => useTableParams());

      expect(result.current.page).toBe(1);
      expect(result.current.rowsPerPage).toBe(25);
      expect(result.current.sort).toEqual({
        sortKey: "updated_at",
        ascending: false,
      });
      expect(result.current.searchTerm).toBe("");
      expect(result.current.platform).toBe("");
      expect(result.current.totalPages).toBe(0);
      expect(result.current.totalRows).toBe(0);
    });

    it("uses custom defaults from options", () => {
      const { result } = renderHook(() =>
        useTableParams({
          defaultSortKey: "created_at",
          defaultPageSize: 50,
        })
      );

      expect(result.current.rowsPerPage).toBe(50);
      expect(result.current.sort).toEqual({
        sortKey: "created_at",
        ascending: false,
      });
    });

    it("returns date range defaulting to last 30 days", () => {
      const { result } = renderHook(() => useTableParams());

      expect(result.current.dateRange).toBeDefined();
      expect(result.current.dateRange?.from).toBeInstanceOf(Date);
      expect(result.current.dateRange?.to).toBeInstanceOf(Date);
    });

    it("uses custom defaultDateRange from options", () => {
      const from = new Date("2024-01-01");
      const to = new Date("2024-01-31");
      const { result } = renderHook(() =>
        useTableParams({ defaultDateRange: { from, to } })
      );

      expect(result.current.dateRange?.from).toEqual(from);
      expect(result.current.dateRange?.to).toEqual(to);
    });
  });

  describe("page from URL", () => {
    it("reads page from search params", () => {
      setUrl("page=3");
      const { result } = renderHook(() => useTableParams());

      expect(result.current.page).toBe(3);
    });

    it("clamps page to minimum of 1", () => {
      setUrl("page=0");
      const { result } = renderHook(() => useTableParams());

      expect(result.current.page).toBe(1);
    });

    it("falls back to 1 for invalid page values", () => {
      setUrl("page=abc");
      const { result } = renderHook(() => useTableParams());

      expect(result.current.page).toBe(1);
    });
  });

  describe("setPage", () => {
    it("updates URL with page number", () => {
      const { result } = renderHook(() => useTableParams());

      act(() => {
        result.current.setPage(5);
      });

      expect(currentUrl()).toBe("/test-path?page=5");
    });

    it("removes page param when setting to page 1", () => {
      const { result } = renderHook(() => useTableParams());

      act(() => {
        result.current.setPage(1);
      });

      expect(currentUrl()).toBe("/test-path");
    });
  });

  describe("rowsPerPage from URL", () => {
    it("reads perPage from search params", () => {
      setUrl("perPage=50");
      const { result } = renderHook(() => useTableParams());

      expect(result.current.rowsPerPage).toBe(50);
    });
  });

  describe("setRowsPerPage", () => {
    it("updates URL and resets page", () => {
      setUrl("page=3");
      const { result } = renderHook(() => useTableParams());

      act(() => {
        result.current.setRowsPerPage(50);
      });

      expect(currentUrl()).toContain("perPage=50");
      // page should be removed (reset)
      expect(currentUrl()).not.toContain("page=");
    });

    it("removes perPage param when setting to default page size", () => {
      const { result } = renderHook(() => useTableParams());

      act(() => {
        result.current.setRowsPerPage(25); // default
      });

      expect(currentUrl()).toBe("/test-path");
    });
  });

  describe("sort from URL", () => {
    it("reads sort from search params", () => {
      setUrl("sort=name:asc");
      const { result } = renderHook(() => useTableParams());

      expect(result.current.sort).toEqual({ sortKey: "name", ascending: true });
    });

    it("reads descending sort", () => {
      setUrl("sort=name:desc");
      const { result } = renderHook(() => useTableParams());

      expect(result.current.sort).toEqual({
        sortKey: "name",
        ascending: false,
      });
    });
  });

  describe("setSort", () => {
    it("updates URL with sort value and resets page", () => {
      const { result } = renderHook(() => useTableParams());

      act(() => {
        result.current.setSort({ sortKey: "name", ascending: true });
      });

      expect(currentUrl()).toBe("/test-path?sort=name%3Aasc");
    });

    it("removes sort param when setting to default sort", () => {
      const { result } = renderHook(() => useTableParams());

      act(() => {
        result.current.setSort({ sortKey: "updated_at", ascending: false });
      });

      expect(currentUrl()).toBe("/test-path");
    });

    it("supports functional updates", () => {
      const { result } = renderHook(() => useTableParams());

      act(() => {
        result.current.setSort((prev) => ({ ...prev, ascending: true }));
      });

      expect(currentUrl()).toBe("/test-path?sort=updated_at%3Aasc");
    });
  });

  describe("searchTerm", () => {
    it("reads search term from URL on mount", () => {
      setUrl("q=hello");
      const { result } = renderHook(() => useTableParams());

      expect(result.current.searchTerm).toBe("hello");
    });

    it("updates local state immediately on setSearchTerm", () => {
      const { result } = renderHook(() => useTableParams());

      act(() => {
        result.current.setSearchTerm("test");
      });

      expect(result.current.searchTerm).toBe("test");
    });
  });

  describe("dateRange from URL", () => {
    it("reads date range from search params", () => {
      const from = "2024-06-01T00:00:00.000Z";
      const to = "2024-06-30T00:00:00.000Z";
      setUrl(`from=${from}&to=${to}`);
      const { result } = renderHook(() => useTableParams());

      expect(result.current.dateRange?.from?.toISOString()).toBe(from);
      expect(result.current.dateRange?.to?.toISOString()).toBe(to);
    });
  });

  describe("setDateRange", () => {
    it("updates URL with date range", () => {
      const { result } = renderHook(() => useTableParams());

      const from = new Date("2024-01-01T00:00:00.000Z");
      const to = new Date("2024-01-31T00:00:00.000Z");
      act(() => {
        result.current.setDateRange({ from, to });
      });

      expect(currentUrl()).toContain("from=");
      expect(currentUrl()).toContain("to=");
    });

    it("clears date params when range is undefined", () => {
      setUrl("from=2024-01-01&to=2024-01-31");
      const { result } = renderHook(() => useTableParams());

      act(() => {
        result.current.setDateRange(undefined);
      });

      expect(currentUrl()).toBe("/test-path");
    });

    it("clears date params when from is missing", () => {
      const { result } = renderHook(() => useTableParams());

      act(() => {
        result.current.setDateRange({ from: undefined, to: new Date() });
      });

      expect(currentUrl()).toBe("/test-path");
    });
  });

  describe("platform", () => {
    it("reads platform from URL", () => {
      setUrl("platform=ios");
      const { result } = renderHook(() => useTableParams());

      expect(result.current.platform).toBe("ios");
    });

    it("defaults to empty string", () => {
      const { result } = renderHook(() => useTableParams());
      expect(result.current.platform).toBe("");
    });
  });

  describe("setPlatform", () => {
    it("updates URL with platform and resets page", () => {
      const { result } = renderHook(() => useTableParams());

      act(() => {
        result.current.setPlatform("android");
      });

      expect(currentUrl()).toBe("/test-path?platform=android");
    });

    it("removes platform param when setting empty string", () => {
      setUrl("platform=ios");
      const { result } = renderHook(() => useTableParams());

      act(() => {
        result.current.setPlatform("");
      });

      expect(currentUrl()).toBe("/test-path");
    });
  });

  describe("totalPages and totalRows", () => {
    it("can update totalPages", () => {
      const { result } = renderHook(() => useTableParams());

      act(() => {
        result.current.setTotalPages(10);
      });

      expect(result.current.totalPages).toBe(10);
    });

    it("can update totalRows", () => {
      const { result } = renderHook(() => useTableParams());

      act(() => {
        result.current.setTotalRows(250);
      });

      expect(result.current.totalRows).toBe(250);
    });
  });
});
