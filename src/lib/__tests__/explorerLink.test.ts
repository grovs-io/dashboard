import { describe, it, expect } from "vitest";
import { buildExplorerHref, METRIC_EVENT_TYPE } from "../explorerLink";

const now = new Date("2026-09-25T10:00:00Z");

describe("buildExplorerHref", () => {
  it("carries the date range and chips, and adds the metric's event_type", () => {
    const href = buildExplorerHref({
      from: new Date("2026-09-01T00:00:00Z"),
      to: new Date("2026-09-20T00:00:00Z"),
      filters: [{ id: "a", field: "country", value: "RO", operator: "is" }],
      metric: "installs",
      now,
    });
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/analytics/event_log");
    expect(url.searchParams.get("from")).not.toBeNull();
    expect(url.searchParams.get("to")).not.toBeNull();
    expect(JSON.parse(url.searchParams.get("filters")!)).toEqual([
      { f: "country", v: "RO", o: "is" },
      { f: "event_type", v: "install", o: "is" },
    ]);
  });

  it("clamps the start to the 90-day aggregate window", () => {
    const href = buildExplorerHref({
      from: new Date("2025-01-01"),
      to: now,
      filters: [],
      now,
    });
    const from = new Date(new URL(href, "http://x").searchParams.get("from")!);
    const diffDays = (now.getTime() - from.getTime()) / 86_400_000;
    expect(diffDays).toBeLessThanOrEqual(90);
  });

  it("replaces an existing event_type chip instead of duplicating it", () => {
    const href = buildExplorerHref({
      filters: [
        { id: "a", field: "event_type", value: "view", operator: "is" },
      ],
      metric: "app_opens",
      now,
    });
    const chips = JSON.parse(
      new URL(href, "http://x").searchParams.get("filters")!
    );
    expect(chips).toEqual([{ f: "event_type", v: "app_open", o: "is" }]);
  });

  it("omits filters when there is nothing to carry", () => {
    const href = buildExplorerHref({ filters: [], now });
    expect(new URL(href, "http://x").searchParams.has("filters")).toBe(false);
  });

  it("maps every overview metric to an Explorer event_type", () => {
    for (const k of [
      "new_users",
      "revenue",
      "views",
      "link_views",
      "opens",
      "installs",
      "reinstalls",
      "link_driven_installs",
      "organic_installs",
      "app_opens",
      "referred_users",
    ]) {
      expect(METRIC_EVENT_TYPE[k]).toBeTruthy();
    }
  });

  it("never emits a start after the end", () => {
    const href = buildExplorerHref({
      from: new Date("2026-09-30"),
      to: new Date("2026-09-10"),
      filters: [],
      now,
    });
    const url = new URL(href, "http://x");
    const from = new Date(url.searchParams.get("from")!);
    const to = new Date(url.searchParams.get("to")!);
    expect(from.getTime()).toBeLessThanOrEqual(to.getTime());
  });

  it("leaves chips untouched for a metric with no event_type mapping", () => {
    const href = buildExplorerHref({
      filters: [{ id: "a", field: "country", value: "RO", operator: "is" }],
      metric: "returning_rate",
      now,
    });
    expect(
      JSON.parse(new URL(href, "http://x").searchParams.get("filters")!)
    ).toEqual([{ f: "country", v: "RO", o: "is" }]);
  });
});
