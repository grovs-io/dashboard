import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/edition", () => ({
  IS_ENTERPRISE: true,
  IS_SELF_HOSTED: false,
}));

import { navGroups, navTrail } from "@/components/layout/navConfig";

const labels = (path: string) => navTrail(path)?.trail.map((c) => c.label);

describe("navTrail", () => {
  it.each([
    ["/dashboard", ["Home"]],
    ["/analytics/event_log", ["Analytics", "Events"]],
    ["/smart_banners", ["Links", "Smart Banners"]],
    ["/dynamic_links/settings/domain", ["Links", "Link Settings", "Domain"]],
    ["/settings/developers/event_stream", ["Developers", "Data Export"]],
    ["/settings/developers/ios_setup", ["Developers", "SDK Setup", "iOS"]],
    ["/settings/team", ["Settings", "Team"]],
    ["/settings/usage", ["Settings", "Usage & Billing"]],
    ["/settings/audit_logs", ["Settings", "Audit Logs"]],
  ])("%s → %j", (path, expected) => {
    expect(labels(path)).toEqual(expected);
  });

  it("keeps the page URL for detail routes so it can be linked", () => {
    expect(navTrail("/segments/abc")).toEqual({
      trail: [{ label: "Audience" }, { label: "Segments", href: "/segments" }],
      matchedUrl: "/segments",
    });
  });

  it("returns null outside the sidebar", () => {
    expect(navTrail("/account")).toBeNull();
  });
});

describe("nav icons", () => {
  it("never repeats an icon across groups, pages and sub-pages", () => {
    const platform = new Set(["iOS", "Android", "Web"]);
    const rows: [string, unknown][] = [];
    for (const group of navGroups(true)) {
      if (group.label) rows.push([group.label, group.icon]);
      for (const item of group.items) {
        rows.push([item.title, item.icon]);
        for (const sub of item.items ?? [])
          if (!platform.has(sub.title)) rows.push([sub.title, sub.icon]);
      }
    }
    const shared = rows.filter(
      ([, icon], i) => icon && rows.some(([, o], j) => j !== i && o === icon)
    );
    expect(shared.map(([title]) => title)).toEqual([]);
  });
});
