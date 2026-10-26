import { describe, it, expect } from "vitest";
import { buildOverviewQueryParams } from "../useOverviewQueryParams";
import { topCampaignsParams, topLinksParams } from "@/lib/topLists";

const range = { from: new Date(2026, 8, 1), to: new Date(2026, 8, 30) }; // Sep 1–30 local

describe("buildOverviewQueryParams", () => {
  it("builds date-only params with no filters", () => {
    const p = buildOverviewQueryParams(range, [], "day");
    expect(p.base).toEqual({
      start_date: "2026-09-01",
      end_date: "2026-09-30",
    });
    expect(p.platform).toBe("");
    expect(p.filtersJson).toBeUndefined();
    expect(p.hasNonPlatformFilters).toBe(false);
    expect(p.trends).toEqual({
      start_date: "2026-09-01",
      end_date: "2026-09-30",
      granularity: "day",
    });
  });

  it("derives the platform from a platform chip and still sends the chip as filters", () => {
    const p = buildOverviewQueryParams(
      range,
      [{ id: "x", field: "platform", value: "ios", operator: "is" }],
      "week"
    );
    expect(p.platform).toBe("ios");
    expect(p.hasNonPlatformFilters).toBe(false);
    expect(p.base.platform).toBe("ios");
    expect(JSON.parse(p.base.filters!)).toEqual([
      { field: "platform", operator: "is", value: "ios" },
    ]);
    expect(p.metrics).toEqual({
      start_date: expect.any(String),
      end_date: expect.any(String),
      platform: "ios",
    });
    expect(p.campaigns?.platform).toBe("ios");
  });

  it("flags non-platform chips", () => {
    const p = buildOverviewQueryParams(
      range,
      [{ id: "x", field: "country", value: "RO", operator: "is" }],
      "day"
    );
    expect(p.hasNonPlatformFilters).toBe(true);
    expect(p.base.platform).toBeUndefined();
    expect(p.campaigns?.platform).toBeUndefined();
  });

  it("computes the previous equal-length range with the same filters", () => {
    const p = buildOverviewQueryParams(
      range,
      [{ id: "x", field: "os", value: "iOS", operator: "is" }],
      "day"
    );
    expect(p.prev).toEqual({
      start_date: "2026-08-02",
      end_date: "2026-08-31",
      filters: p.base.filters,
    });
  });

  it("returns null legacy params when the range is open", () => {
    const p = buildOverviewQueryParams(undefined, [], "day");
    expect(p.prev).toBeUndefined();
    expect(p.metrics).toBeNull();
    expect(p.campaigns).toBeNull();
  });

  it("treats two platform chips as non-platform (backend raw mode)", () => {
    const p = buildOverviewQueryParams(
      range,
      [
        { id: "a", field: "platform", value: "ios", operator: "is" },
        { id: "b", field: "platform", value: "android", operator: "is" },
      ],
      "day"
    );
    expect(p.hasNonPlatformFilters).toBe(true);
  });

  it("treats platform is_not as non-platform", () => {
    const p = buildOverviewQueryParams(
      range,
      [{ id: "a", field: "platform", value: "ios", operator: "is_not" }],
      "day"
    );
    expect(p.hasNonPlatformFilters).toBe(true);
    expect(p.platform).toBe("");
  });

  it("combines a platform chip with a non-platform chip", () => {
    const p = buildOverviewQueryParams(
      range,
      [
        { id: "a", field: "platform", value: "ios", operator: "is" },
        { id: "b", field: "country", value: "RO", operator: "is" },
      ],
      "day"
    );
    expect(p.hasNonPlatformFilters).toBe(true);
    expect(p.platform).toBe("ios");
    expect(p.base.platform).toBe("ios");
  });

  it("sends the same whole-day top links / campaigns ranges as the panel widgets", () => {
    const withTime = {
      from: new Date(2026, 8, 1, 14, 37, 12),
      to: new Date(2026, 8, 30, 9, 5, 0),
    };
    const p = buildOverviewQueryParams(
      withTime,
      [{ id: "x", field: "platform", value: "ios", operator: "is" }],
      "day"
    );
    expect(p.campaigns).toEqual(topCampaignsParams(p.base));
    expect(p.metrics).toEqual(topLinksParams(p.base));
    expect(p.campaigns).toEqual(
      expect.objectContaining({
        start_date: "2026-09-01 00:00:00",
        end_date: "2026-09-30 23:59:59",
        per_page: 5,
        platform: "ios",
      })
    );
  });
});
