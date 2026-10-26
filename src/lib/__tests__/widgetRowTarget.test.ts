import { describe, it, expect } from "vitest";
import { rowsClickable, rowTarget } from "../widgetRowTarget";

const base = { start_date: "2026-10-01", end_date: "2026-10-14" };
const now = new Date();
const chips = (href: string) =>
  JSON.parse(new URL(href, "http://x").searchParams.get("filters")!);

describe("rowTarget", () => {
  it("opens a campaign row on its campaign page", () => {
    expect(
      rowTarget({
        groupBy: "campaign_id",
        key: "12",
        label: "Summer",
        base,
        filters: [],
      })
    ).toEqual({ kind: "campaign", id: "12" });
  });

  it("opens a link row in the link dialog", () => {
    expect(
      rowTarget({
        groupBy: "link_id",
        key: "7",
        label: "Promo",
        base,
        filters: [],
      })
    ).toEqual({ kind: "link", id: "7" });
  });

  it.each(["link_views", "link_driven_installs"])(
    "leaves %s rows unclickable unless grouped by campaign or link",
    (metric) => {
      const row = (groupBy: string) =>
        rowTarget({
          groupBy,
          key: "12",
          label: "x",
          metric,
          base,
          filters: [],
        });
      expect(row("country")).toBeNull();
      expect(row("campaign_id")).toEqual({ kind: "campaign", id: "12" });
      expect(row("link_id")).toEqual({ kind: "link", id: "12" });
    }
  );

  it.each([
    ["country", "US", "United States"],
    ["event_name", "add_to_cart", "add_to_cart"],
    ["app_version", "4.2.0", "4.2.0"],
    ["tracking_source", "instagram", "instagram"],
  ])(
    "sends a %s row to the Events Explorer filtered by it",
    (groupBy, key, label) => {
      const t = rowTarget({
        groupBy,
        key,
        label,
        metric: "installs",
        base,
        filters: [{ field: "platform", operator: "is", value: "ios" }],
      });
      expect(t?.kind).toBe("explorer");
      const href = (t as { href: string }).href;
      expect(href.startsWith("/analytics/event_log?")).toBe(true);
      expect(chips(href)).toEqual([
        { f: "platform", v: "ios", o: "is" },
        { f: groupBy, v: key, o: "is", d: label },
        { f: "event_type", v: "install", o: "is" },
      ]);
      const from = new URL(href, "http://x").searchParams.get("from")!;
      // Clamped to the Explorer window when the range is older than it.
      expect(new Date(from) <= now).toBe(true);
    }
  );

  it("replaces a page chip on the same field instead of ANDing two values", () => {
    const t = rowTarget({
      groupBy: "country",
      key: "DE",
      label: "Germany",
      base,
      filters: [{ field: "country", operator: "is", value: "RO" }],
    });
    expect(chips((t as { href: string }).href)).toEqual([
      { f: "country", v: "DE", o: "is", d: "Germany" },
    ]);
  });

  it("ignores the Other and empty buckets", () => {
    expect(
      rowTarget({
        groupBy: "country",
        key: "__other__",
        label: "Other",
        base,
        filters: [],
      })
    ).toBeNull();
    expect(
      rowTarget({
        groupBy: "country",
        key: "",
        label: "(none)",
        base,
        filters: [],
      })
    ).toBeNull();
  });
});

describe("rowsClickable", () => {
  it.each([
    ["country", "link_views", false],
    ["country", "link_driven_installs", false],
    ["link_id", "link_views", true],
    ["campaign_id", "link_views", true],
    ["country", "installs", true],
    ["country", undefined, true],
  ])("%s + %s → %s", (groupBy, metric, expected) => {
    expect(rowsClickable({ groupBy, metric })).toBe(expected);
  });
});
