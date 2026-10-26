import { describe, it, expect } from "vitest";
import { sizeClass, mergeFilterList, withMergedFilters } from "../widgetLayout";

describe("widgetLayout", () => {
  it("maps sizes to column spans", () => {
    expect(sizeClass("sm")).toBe("");
    expect(sizeClass("md")).toBe("@3xl/main:col-span-2");
    expect(sizeClass("lg")).toBe("@3xl/main:col-span-3");
  });
  it("merges page chips and stored filters", () => {
    const list = mergeFilterList(
      [
        {
          id: "a",
          field: "platform",
          value: "ios",
          operator: "is",
          displayValue: "iOS",
        },
      ],
      [{ field: "country", operator: "is", value: "RO" }]
    );
    expect(list).toEqual([
      { field: "platform", operator: "is", value: "ios" },
      { field: "country", operator: "is", value: "RO" },
    ]);
    expect(mergeFilterList([], [])).toEqual([]);
  });
  it("dedupes identical chips and keeps distinct ones in order", () => {
    const list = mergeFilterList(
      [
        { id: "a", field: "platform", value: "ios", operator: "is" },
        { id: "b", field: "country", value: "RO", operator: "is" },
      ],
      [
        { field: "platform", operator: "is", value: "ios" },
        { field: "platform", operator: "is_not", value: "ios" },
        { field: "country", operator: "is", value: "DE" },
      ]
    );
    expect(list).toEqual([
      { field: "platform", operator: "is", value: "ios" },
      { field: "country", operator: "is", value: "RO" },
      { field: "platform", operator: "is_not", value: "ios" },
      { field: "country", operator: "is", value: "DE" },
    ]);
  });
  it("swaps the page's filter JSON for the merged list, or drops it when empty", () => {
    const base = {
      start_date: "2026-09-01",
      end_date: "2026-09-30",
      platform: "ios",
      filters: '[{"field":"os","operator":"is","value":"x"}]',
    };
    const merged = [{ field: "country", operator: "is" as const, value: "RO" }];
    expect(withMergedFilters(base, merged)).toEqual({
      start_date: "2026-09-01",
      end_date: "2026-09-30",
      platform: "ios",
      filters: JSON.stringify(merged),
    });
    expect(withMergedFilters(base, [])).toEqual({
      start_date: "2026-09-01",
      end_date: "2026-09-30",
      platform: "ios",
    });
  });
});
