import { describe, it, expect } from "vitest";
import {
  bannerToFormValues,
  buildSmartBannerFormData,
  buildStatusFormData,
  moveId,
  moveToEdge,
  prioritised,
  BANNER_ACTIONS,
  dismissRate,
  formatCtr,
  smartBannerSnippet,
  setupStage,
  isIntegrated,
  bannerDisplayStatus,
  sumStats,
  filterBanners,
} from "../smartBanners";
import {
  SMART_BANNER_DEFAULTS,
  type SmartBannerFormValues,
} from "@/schemas/smartBanner";
import type { SmartBanner } from "@/types";

const valid = (
  over: Partial<SmartBannerFormValues> = {}
): SmartBannerFormValues => ({
  ...SMART_BANNER_DEFAULTS,
  name: "Products",
  title: "Get the app",
  ...over,
});

const banner: SmartBanner = {
  id: 7,
  name: "Products",
  status: "live",
  priority: 0,
  platforms: ["ios"],
  url_include: ["/products/*"],
  url_exclude: [],
  position: "bottom",
  title: "Get the app",
  subtitle: null,
  button_text: "Open",
  background_color: "#FFFFFF",
  text_color: "#111827",
  button_color: "#2563EB",
  button_text_color: "#FFFFFF",
  icon_url: "https://cdn/icon.png",
  dismiss_days: 7,
  open_hide_days: 30,
  default_link: "https://x.grovs.io/abc",
  created_at: "2026-10-05T00:00:00Z",
  updated_at: "2026-10-05T00:00:00Z",
  stats: {
    views: 10,
    clicks: 2,
    dismisses: 1,
    ctr: 0.2,
    opens: 1,
    installs: 1,
  },
};

describe("bannerToFormValues", () => {
  it("maps arrays to lines and nulls to empty strings", () => {
    const v = bannerToFormValues(banner);
    expect(v.url_include).toBe("/products/*");
    expect(v.all_pages).toBe(false);
    expect(bannerToFormValues({ ...banner, url_include: [] }).all_pages).toBe(
      true
    );
    expect(v.open_hide_days).toBe(30);
    expect(v.url_exclude).toBe("");
    expect(v.subtitle).toBe("");
    expect(v.icon).toBeNull();
    expect(v.remove_icon).toBe(false);
  });
});

describe("buildSmartBannerFormData", () => {
  it("writes every field under smart_banner[...]", () => {
    const fd = buildSmartBannerFormData(
      valid({
        all_pages: false,
        url_include: "/a\n*",
        platforms: ["ios", "android"],
      })
    );
    expect(fd.get("smart_banner[name]")).toBe("Products");
    expect(fd.get("smart_banner[status]")).toBeNull();
    expect(fd.getAll("smart_banner[platforms][]")).toEqual(["ios", "android"]);
    expect(fd.getAll("smart_banner[url_include][]")).toEqual(["/a", "/*"]);
    expect(fd.get("smart_banner[open_hide_days]")).toBe("30");
    expect(fd.get("smart_banner[dismiss_days]")).toBe("7");
    expect(fd.get("smart_banner[position]")).toBe("top");
  });

  it("sends the status only when given", () => {
    expect(
      buildSmartBannerFormData(valid(), "live").get("smart_banner[status]")
    ).toBe("live");
  });

  it("sends an empty include list when shown on all pages", () => {
    const fd = buildSmartBannerFormData(
      valid({ all_pages: true, url_include: "/left/over" })
    );
    expect(fd.getAll("smart_banner[url_include][]")).toEqual([""]);
  });

  it("sends one blank entry for an empty array so the backend clears it", () => {
    const fd = buildSmartBannerFormData(valid({ url_exclude: "" }));
    expect(fd.getAll("smart_banner[url_exclude][]")).toEqual([""]);
  });

  it("includes the icon file or remove flag", () => {
    const icon = new File(["x"], "a.png", { type: "image/png" });
    expect(
      buildSmartBannerFormData(valid({ icon })).get("smart_banner[icon]")
    ).toBeInstanceOf(File);
    const removed = buildSmartBannerFormData(valid({ remove_icon: true }));
    expect(removed.get("smart_banner[remove_icon]")).toBe("true");
    expect(removed.get("smart_banner[icon]")).toBeNull();
  });
});

describe("buildStatusFormData", () => {
  it("sends only the status", () => {
    const fd = buildStatusFormData("paused");
    expect([...fd.keys()]).toEqual(["smart_banner[status]"]);
    expect(fd.get("smart_banner[status]")).toBe("paused");
  });
});

describe("moveToEdge", () => {
  it("moves an id to the top or bottom", () => {
    expect(moveToEdge([1, 2, 3], 3, "top")).toEqual([3, 1, 2]);
    expect(moveToEdge([1, 2, 3], 1, "bottom")).toEqual([2, 3, 1]);
  });
});

describe("prioritised", () => {
  it("drops archived banners and keeps the order", () => {
    const list = [3, 1, 2].map(
      (id) =>
        ({
          ...banner,
          id,
          status: id === 1 ? "archived" : "live",
        }) as SmartBanner
    );
    expect(prioritised(list).map((b) => b.id)).toEqual([3, 2]);
  });
});

describe("BANNER_ACTIONS", () => {
  it("offers each status its lifecycle actions", () => {
    expect(BANNER_ACTIONS.draft).toEqual([
      "publish",
      "edit",
      "duplicate",
      "delete",
    ]);
    expect(BANNER_ACTIONS.live).toEqual([
      "pause",
      "edit",
      "duplicate",
      "archive",
    ]);
    expect(BANNER_ACTIONS.paused).toEqual([
      "resume",
      "edit",
      "duplicate",
      "archive",
      "delete",
    ]);
    expect(BANNER_ACTIONS.archived).toEqual(["restore", "duplicate", "delete"]);
  });
});

describe("moveId", () => {
  it("moves an id to the position of another", () => {
    expect(moveId([1, 2, 3], 3, 1)).toEqual([3, 1, 2]);
    expect(moveId([1, 2, 3], 1, 3)).toEqual([2, 3, 1]);
  });

  it("returns the same order for unknown ids", () => {
    expect(moveId([1, 2], 9, 1)).toEqual([1, 2]);
  });
});

describe("formatCtr", () => {
  it("formats a ratio as a percentage with one decimal", () => {
    expect(formatCtr(0.2)).toBe("20.0%");
    expect(formatCtr(0)).toBe("0.0%");
  });
});

describe("smartBannerSnippet", () => {
  it("embeds the API key and the setLinkData call for production", () => {
    const s = smartBannerSnippet("key-123", false);
    expect(s).toContain('Grovs.configure({ apiKey: "key-123" })');
    expect(s).not.toContain("testEnvironment");
    expect(s).toContain(
      'Grovs.smartBanner.setLinkData({ data: { productId: "123" } })'
    );
  });

  it("adds testEnvironment for the test project", () => {
    expect(smartBannerSnippet("key-123", true)).toContain(
      'Grovs.configure({ apiKey: "key-123", testEnvironment: true })'
    );
  });
});

describe("setupStage", () => {
  const st = (
    web_configured: boolean,
    domains: string[],
    seen: string | null
  ) => ({
    web_configured,
    domains,
    sdk_last_seen_at: seen,
  });
  it("needs a domain first", () => {
    expect(setupStage(st(false, [], null))).toBe("domain");
    expect(setupStage(st(true, [], null))).toBe("domain");
  });
  it("is ready whenever the SDK has been seen", () => {
    expect(setupStage(st(false, [], "2026-10-05T10:00:00Z"))).toBe("ready");
    expect(isIntegrated(st(false, [], "2026-10-05T10:00:00Z"))).toBe(true);
    expect(isIntegrated(undefined)).toBe(false);
  });
  it("is ready as soon as a domain is linked, without waiting for the SDK", () => {
    expect(isIntegrated(st(true, ["shop.com"], null))).toBe(true);
    expect(setupStage(st(true, ["shop.com"], null))).toBe("ready");
    expect(setupStage(st(true, ["shop.com"], "2026-10-05T10:00:00Z"))).toBe(
      "ready"
    );
  });
  it("needs web configured as well as a domain", () => {
    expect(isIntegrated(st(false, ["shop.com"], null))).toBe(false);
  });
});

describe("bannerDisplayStatus", () => {
  it("flags a live banner without a link as not live, else keeps the status", () => {
    expect(bannerDisplayStatus({ status: "paused", default_link: null })).toBe(
      "paused"
    );
    expect(bannerDisplayStatus({ status: "draft", default_link: null })).toBe(
      "draft"
    );
    expect(bannerDisplayStatus({ status: "live", default_link: null })).toBe(
      "not_live"
    );
    expect(
      bannerDisplayStatus({ status: "live", default_link: "https://x" })
    ).toBe("live");
  });
});

describe("sumStats", () => {
  it("sums across banners and derives CTR from the totals", () => {
    const stats = (
      views: number,
      clicks: number,
      installs: number,
      dismisses = 0
    ) =>
      ({
        ...banner,
        stats: { views, clicks, installs, dismisses, ctr: 0, opens: 0 },
      }) as SmartBanner;
    expect(sumStats([stats(100, 10, 2, 5), stats(300, 30, 3, 15)])).toEqual({
      views: 400,
      clicks: 40,
      dismisses: 20,
      installs: 5,
      ctr: 0.1,
    });
    expect(sumStats([]).ctr).toBe(0);
  });
});

describe("dismissRate", () => {
  it("divides dismisses by views", () => {
    expect(dismissRate(5, 200)).toBe(0.025);
  });

  it("is undefined when there were no views", () => {
    expect(dismissRate(0, 0)).toBeUndefined();
  });
});

describe("filterBanners", () => {
  const list: SmartBanner[] = [
    {
      ...banner,
      id: 1,
      name: "Products",
      title: "Shop in the app",
      platforms: ["ios"],
    },
    {
      ...banner,
      id: 2,
      name: "Blog",
      title: "Read more",
      status: "paused",
      platforms: ["android"],
    },
    {
      ...banner,
      id: 3,
      name: "Sale",
      title: "Deals",
      default_link: null,
      platforms: ["ios", "android"],
    },
    {
      ...banner,
      id: 4,
      name: "Old",
      title: "Deals",
      status: "archived",
      platforms: ["ios"],
    },
    {
      ...banner,
      id: 5,
      name: "Next",
      title: "Soon",
      status: "draft",
      platforms: ["ios"],
    },
  ];
  const ids = (f: Partial<Parameters<typeof filterBanners>[1]>) =>
    filterBanners(list, { term: "", status: "", platform: "", ...f }).map(
      (b) => b.id
    );

  it("matches name or title, ignoring case", () => {
    expect(ids({ term: "blog" })).toEqual([2]);
    expect(ids({ term: " SHOP " })).toEqual([1]);
  });

  it("filters by status and platform, leaving archived banners out of All", () => {
    expect(ids({})).toEqual([1, 2, 3, 5]);
    expect(ids({ status: "live" })).toEqual([1, 3]);
    expect(ids({ status: "paused" })).toEqual([2]);
    expect(ids({ status: "draft" })).toEqual([5]);
    expect(ids({ status: "archived" })).toEqual([4]);
    expect(ids({ platform: "android" })).toEqual([2, 3]);
    expect(ids({ platform: "ios", term: "sale" })).toEqual([3]);
  });
});
