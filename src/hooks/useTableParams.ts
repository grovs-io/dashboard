"use client";

import { useSearchParams } from "next/navigation";
import {
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DateRange } from "react-day-picker";
import type { SortType } from "@/types";
import type { QueryFilter } from "@/components/analytics/events/types";
import { writeSearchParams } from "@/lib/searchParamsUrl";

interface UseTableParamsOptions {
  defaultSortKey?: string;
  defaultPageSize?: number;
  defaultDateRange?: { from: Date; to: Date };
}

/** Compact URL shape for a QueryBar filter: field / value / operator / displayValue. */
type SerializedFilter = {
  f: string;
  v: string;
  o: QueryFilter["operator"];
  d?: string;
};

/**
 * Derive the bare platform string from the QueryBar chips. Platform is just
 * another filter field on the analytics screens, so it has no separate URL key.
 */
export function platformFromQueryFilters(filters: QueryFilter[]): string {
  return (
    filters.find((f) => f.field === "platform" && f.operator === "is")?.value ??
    ""
  );
}

export function useTableParams(options?: UseTableParamsOptions) {
  const {
    defaultSortKey = "updated_at",
    defaultPageSize = 25,
    defaultDateRange,
  } = options ?? {};

  const searchParams = useSearchParams();

  // Helper to update multiple params at once
  const updateParams = useCallback((updates: Record<string, string | null>) => {
    writeSearchParams(updates);
  }, []);

  // --- Page ---
  const page = useMemo(() => {
    const raw = searchParams.get("page");
    return raw ? Math.max(1, parseInt(raw, 10) || 1) : 1;
  }, [searchParams]);

  const setPage = useCallback(
    (p: number) => updateParams({ page: p === 1 ? null : String(p) }),
    [updateParams]
  );

  // --- Rows per page ---
  const rowsPerPage = useMemo(() => {
    const raw = searchParams.get("perPage");
    return raw ? parseInt(raw, 10) || defaultPageSize : defaultPageSize;
  }, [searchParams, defaultPageSize]);

  const setRowsPerPage = useCallback(
    (n: number) =>
      updateParams({
        perPage: n === defaultPageSize ? null : String(n),
        page: null, // reset page
      }),
    [updateParams, defaultPageSize]
  );

  // --- Sort ---
  const sort: SortType = useMemo(() => {
    const raw = searchParams.get("sort");
    if (raw) {
      const [sortKey, dir] = raw.split(":");
      return { sortKey: sortKey ?? defaultSortKey, ascending: dir === "asc" };
    }
    return { sortKey: defaultSortKey, ascending: false };
  }, [searchParams, defaultSortKey]);

  const setSort = useCallback(
    (action: SetStateAction<SortType>) => {
      const s = typeof action === "function" ? action(sort) : action;
      const isDefault = s.sortKey === defaultSortKey && s.ascending === false;
      updateParams({
        sort: isDefault ? null : `${s.sortKey}:${s.ascending ? "asc" : "desc"}`,
        page: null, // reset page
      });
    },
    [updateParams, defaultSortKey, sort]
  );

  // --- Search term (debounced URL write) ---
  const [searchTerm, setSearchTermLocal] = useState(() => {
    return searchParams.get("q") ?? "";
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setSearchTerm = useCallback(
    (term: string) => {
      setSearchTermLocal(term);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateParams({ q: term || null, page: null });
      }, 300);
    },
    [updateParams]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Sync from URL on back/forward navigation
  useEffect(() => {
    const urlTerm = searchParams.get("q") ?? "";
    setSearchTermLocal(urlTerm);
  }, [searchParams]);

  // --- Date range ---
  const getDefaultDates = useCallback(() => {
    if (defaultDateRange) return defaultDateRange;
    const now = new Date();
    const from = new Date();
    from.setDate(now.getDate() - 30);
    return { from, to: now };
  }, [defaultDateRange]);

  const dateRange: DateRange | undefined = useMemo(() => {
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    if (fromStr && toStr) {
      return {
        from: new Date(fromStr),
        to: new Date(toStr),
      };
    }
    return getDefaultDates();
  }, [searchParams, getDefaultDates]);

  // True when the range is the untouched default (no explicit from/to in the
  // URL). Lets consumers avoid showing a sticky preset label (e.g. "Today")
  // over a wider range carried in the URL across reloads.
  const isDefaultDateRange = !searchParams.get("from");

  const setDateRange = useCallback(
    (range: DateRange | undefined) => {
      if (!range?.from || !range?.to) {
        updateParams({ from: null, to: null, page: null });
        return;
      }
      updateParams({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        page: null,
      });
    },
    [updateParams]
  );

  // --- Platform ---
  const platform = useMemo(
    () => searchParams.get("platform") ?? "",
    [searchParams]
  );

  const setPlatform = useCallback(
    (p: string) => updateParams({ platform: p || null, page: null }),
    [updateParams]
  );

  // --- Query filters (QueryBar chips, URL-backed via the `filters` param) ---
  const queryFilters = useMemo<QueryFilter[]>(() => {
    const raw = searchParams.get("filters");
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw) as SerializedFilter[];
      return arr.map((item, i) => ({
        // Stable id derived from contents so React keys don't churn per render.
        id: `url_${i}_${item.f}_${item.o}_${item.v}`,
        field: item.f,
        value: item.v,
        operator: item.o,
        ...(item.d ? { displayValue: item.d } : {}),
      }));
    } catch {
      return [];
    }
  }, [searchParams]);

  const writeFilters = useCallback(
    (filters: QueryFilter[]) => {
      const serialized = filters.length
        ? JSON.stringify(
            filters.map<SerializedFilter>((f) => ({
              f: f.field,
              v: f.value,
              o: f.operator,
              ...(f.displayValue ? { d: f.displayValue } : {}),
            }))
          )
        : null;
      updateParams({ filters: serialized, page: null });
    },
    [updateParams]
  );

  const addFilter = useCallback(
    (
      field: string,
      value: string,
      operator: QueryFilter["operator"],
      displayValue?: string
    ) => {
      const exists = queryFilters.some(
        (f) => f.field === field && f.value === value && f.operator === operator
      );
      if (exists) return;
      writeFilters([
        ...queryFilters,
        {
          id: `${field}_${operator}_${value}`,
          field,
          value,
          operator,
          ...(displayValue ? { displayValue } : {}),
        },
      ]);
    },
    [queryFilters, writeFilters]
  );

  const removeFilter = useCallback(
    (id: string) => writeFilters(queryFilters.filter((f) => f.id !== id)),
    [queryFilters, writeFilters]
  );

  const clearAllFilters = useCallback(() => writeFilters([]), [writeFilters]);

  // --- Total pages / total rows (server-driven, not URL) ---
  const [totalPages, setTotalPages] = useState(0);
  const [totalRows, setTotalRows] = useState(0);

  return {
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
    sort,
    setSort,
    searchTerm,
    setSearchTerm,
    dateRange,
    setDateRange,
    isDefaultDateRange,
    platform,
    setPlatform,
    queryFilters,
    setQueryFilters: writeFilters,
    addFilter,
    removeFilter,
    clearAllFilters,
    totalPages,
    setTotalPages,
    totalRows,
    setTotalRows,
  };
}
