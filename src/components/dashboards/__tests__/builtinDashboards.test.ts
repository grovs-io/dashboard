import { describe, it, expect } from "vitest";
import {
  BUILTIN_DASHBOARDS,
  builtinDashboard,
  builtinSpanClass,
  widgetPayload,
} from "../builtinDashboards";
import { needsSetup } from "@/lib/sdkStatus";
import { MAX_WIDGETS } from "../DashboardBoard";
import { cardSubtitle } from "../WidgetCard";

const status = {
  ios_seen_at: null,
  android_seen_at: null,
  web_seen_at: null,
  has_events: true,
  has_purchases: true,
  has_links: true,
};

describe("built-in dashboards", () => {
  it("defines Overview, Acquisition, Engagement, Revenue and Links in that order", () => {
    expect(BUILTIN_DASHBOARDS.map((d) => [d.key, d.name])).toEqual([
      ["", "Overview"],
      ["acquisition", "Acquisition"],
      ["engagement", "Engagement"],
      ["revenue", "Revenue"],
      ["links", "Links"],
    ]);
  });

  it("gives static widgets unique negative ids, in order, under the widget cap", () => {
    const ids = BUILTIN_DASHBOARDS.flatMap((d) => d.widgets.map((w) => w.id));
    expect(ids.every((id) => id < 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of BUILTIN_DASHBOARDS) {
      expect(d.widgets.length).toBeLessThanOrEqual(MAX_WIDGETS);
      expect(d.widgets.map((w) => w.position)).toEqual(
        d.widgets.map((_, i) => i)
      );
    }
  });

  it("starts every dashboard but Overview with its KPI row", () => {
    expect(
      BUILTIN_DASHBOARDS.slice(1).map((d) =>
        d.widgets[0]?.kind === "panel" ? d.widgets[0].panel : null
      )
    ).toEqual([
      "kpis_acquisition",
      "kpis_engagement",
      "kpis_revenue",
      "kpis_links",
    ]);
  });

  it("uses the spec's queries for the metric widgets", () => {
    const queries = (key: string) =>
      builtinDashboard(key)!.widgets.flatMap((w) =>
        w.kind === "metric" ? [[w.title, w.query]] : []
      );
    const top5 = (metric: string, group_by: string) => ({
      metric,
      group_by,
      limit: 5,
    });
    expect(queries("acquisition")).toEqual([
      ["By platform", top5("installs", "platform")],
      ["Installs by country", top5("installs", "country")],
      ["Top campaigns", top5("link_driven_installs", "campaign_id")],
      ["Top sources", top5("installs", "tracking_source")],
    ]);
    expect(queries("engagement")).toEqual([
      ["App opens", { metric: "app_opens" }],
      ["Top events", top5("events", "event_name")],
      ["Opens by app version", top5("app_opens", "app_version")],
    ]);
    expect(queries("links")).toEqual([
      ["Link views", { metric: "link_views" }],
      ["Views by country", top5("link_views", "country")],
      ["Top links", top5("link_views", "link_id")],
      ["Top campaigns", top5("link_views", "campaign_id")],
    ]);
  });

  it("draws every grouped list as a bar list", () => {
    const grouped = BUILTIN_DASHBOARDS.flatMap((d) =>
      d.widgets.filter((w) => w.kind === "metric" && w.query.group_by)
    );
    expect(grouped.length).toBe(9);
    expect(grouped.every((w) => w.viz === "bar")).toBe(true);
  });

  it("gives every titled widget a short hint, with the period from the granularity", () => {
    for (const d of BUILTIN_DASHBOARDS)
      for (const w of d.widgets) expect(w.subtitle).toBeTruthy();
    const trend = builtinDashboard("acquisition")!.widgets[1]!;
    expect(cardSubtitle(trend, "day")).toBe("Daily, vs previous period");
    expect(cardSubtitle(trend, "week")).toBe("Weekly, vs previous period");
    expect(
      builtinDashboard("links")!
        .widgets.map((w) => w.viewAll)
        .filter(Boolean)
    ).toEqual(["/dynamic_links/links", "/dynamic_links/campaigns"]);
  });

  it("drops a generated subtitle that only repeats the title", () => {
    const channels = {
      ...builtinDashboard("acquisition")!.widgets[2]!,
      subtitle: null,
    };
    expect(channels.title).toBe("Acquisition channels");
    expect(cardSubtitle(channels, "day")).toBeUndefined();
    const platform = {
      ...builtinDashboard("acquisition")!.widgets[3]!,
      subtitle: undefined,
    };
    expect(cardSubtitle(platform, "day")).toMatch(/by Platform/);
  });

  it("turns widgets into API payloads without ids or layout hints", () => {
    const payloads = builtinDashboard("links")!.widgets.map(widgetPayload);
    expect(payloads[0]).toEqual({
      title: "Key numbers",
      subtitle: "vs previous period",
      viz: "number",
      size: "lg",
      filters: [],
      kind: "panel",
      panel: "kpis_links",
      query: {},
    });
    expect(payloads[1]).toEqual({
      title: "Link views",
      subtitle: "{period}",
      viz: "line",
      size: "md",
      filters: [],
      kind: "metric",
      panel: null,
      query: { metric: "link_views" },
    });
    expect(
      payloads.some((p) => ["id", "half", "viewAll"].some((k) => k in p))
    ).toBe(false);
  });

  it("lays half widgets side by side on the six-column grid", () => {
    const widgets = builtinDashboard("links")!.widgets;
    const links = widgets[3]!;
    const campaigns = widgets[4]!;
    expect(builtinSpanClass(links)).toBe("@3xl/main:col-span-3");
    expect(builtinSpanClass(campaigns)).toBe("@3xl/main:col-span-3");
    expect(builtinSpanClass(widgets[0]!)).toBe("@3xl/main:col-span-6");
  });

  it("needs setup only when its data is missing, and never without a status", () => {
    expect(needsSetup("events", undefined)).toBe(false);
    expect(needsSetup("events", status)).toBe(false);
    expect(needsSetup("events", { ...status, has_events: false })).toBe(true);
    expect(needsSetup("purchases", { ...status, has_purchases: false })).toBe(
      true
    );
    expect(needsSetup("purchases", { ...status, has_events: false })).toBe(
      false
    );
    expect(needsSetup("links", { ...status, has_links: false })).toBe(true);
  });
});
