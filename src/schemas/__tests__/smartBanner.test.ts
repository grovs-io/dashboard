import { describe, it, expect } from "vitest";
import {
  smartBannerSchema,
  SMART_BANNER_DEFAULTS,
  parsePatterns,
  ICON_MAX_BYTES,
  INCLUDE_REQUIRED,
  type SmartBannerFormValues,
} from "../smartBanner";

const valid = (
  over: Partial<SmartBannerFormValues> = {}
): SmartBannerFormValues => ({
  ...SMART_BANNER_DEFAULTS,
  name: "Products",
  title: "Get the app",
  ...over,
});

const issuePaths = (v: SmartBannerFormValues) => {
  const r = smartBannerSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("smartBannerSchema", () => {
  it("accepts defaults with a name and title", () => {
    expect(issuePaths(valid())).toEqual([]);
  });

  it("requires name, title and button text", () => {
    expect(
      issuePaths(valid({ name: " ", title: "", button_text: "" }))
    ).toEqual(expect.arrayContaining(["name", "title", "button_text"]));
  });

  it("enforces the backend length limits", () => {
    expect(issuePaths(valid({ name: "n".repeat(100) }))).toEqual([]);
    expect(issuePaths(valid({ name: "n".repeat(101) }))).toContain("name");
    expect(issuePaths(valid({ title: "t".repeat(81) }))).toContain("title");
    expect(issuePaths(valid({ subtitle: "s".repeat(121) }))).toContain(
      "subtitle"
    );
    expect(issuePaths(valid({ button_text: "b".repeat(25) }))).toContain(
      "button_text"
    );
  });

  it("requires at least one platform", () => {
    expect(issuePaths(valid({ platforms: [] }))).toContain("platforms");
  });

  it("rejects patterns that do not start with /", () => {
    expect(
      issuePaths(valid({ all_pages: false, url_include: "products/*" }))
    ).toContain("url_include");
  });

  it("rejects patterns longer than 256 characters", () => {
    expect(
      issuePaths(
        valid({ all_pages: false, url_include: `/${"a".repeat(255)}` })
      )
    ).toEqual([]);
    expect(
      issuePaths(
        valid({ all_pages: false, url_include: `/${"a".repeat(256)}` })
      )
    ).toContain("url_include");
  });

  it("rejects more than 20 patterns", () => {
    const many = Array.from({ length: 21 }, (_, i) => `/p${i}`).join("\n");
    expect(issuePaths(valid({ url_exclude: many }))).toContain("url_exclude");
  });

  it("needs no pages when shown on all pages, and ignores leftover patterns", () => {
    expect(issuePaths(valid())).toEqual([]);
    expect(issuePaths(valid({ url_include: "oops" }))).toEqual([]);
  });

  it("requires a page pattern when not shown on all pages", () => {
    const r = smartBannerSchema.safeParse(
      valid({ all_pages: false, url_include: " \n " })
    );
    expect(r.success).toBe(false);
    expect(r.error?.issues).toEqual([
      expect.objectContaining({
        path: ["url_include"],
        message: INCLUDE_REQUIRED,
      }),
    ]);
  });

  it("accepts a bare * as /*", () => {
    expect(parsePatterns("*\n/blog/*")).toEqual(["/*", "/blog/*"]);
    expect(issuePaths(valid({ all_pages: false, url_include: "*" }))).toEqual(
      []
    );
  });

  it("bounds open_hide_days to 0..365 integers", () => {
    expect(SMART_BANNER_DEFAULTS.open_hide_days).toBe(30);
    expect(issuePaths(valid({ open_hide_days: -1 }))).toContain(
      "open_hide_days"
    );
    expect(issuePaths(valid({ open_hide_days: 366 }))).toContain(
      "open_hide_days"
    );
    expect(issuePaths(valid({ open_hide_days: 0 }))).toEqual([]);
  });

  it("accepts the default new banner as filled in by hand", () => {
    expect(
      issuePaths(
        valid({ name: "testtest", title: "test", subtitle: "donwload the app" })
      )
    ).toEqual([]);
  });

  it("rejects non-hex colors", () => {
    expect(issuePaths(valid({ button_color: "blue" }))).toContain(
      "button_color"
    );
    expect(issuePaths(valid({ text_color: "#FFF" }))).toContain("text_color");
  });

  it("bounds dismiss_days to 0..365 integers", () => {
    expect(issuePaths(valid({ dismiss_days: -1 }))).toContain("dismiss_days");
    expect(issuePaths(valid({ dismiss_days: 366 }))).toContain("dismiss_days");
    expect(issuePaths(valid({ dismiss_days: 1.5 }))).toContain("dismiss_days");
    expect(issuePaths(valid({ dismiss_days: 0 }))).toEqual([]);
  });

  it("rejects wrong icon type and oversized icons", () => {
    const gif = new File(["x"], "a.gif", { type: "image/gif" });
    expect(issuePaths(valid({ icon: gif }))).toContain("icon");
    const big = new File([new Uint8Array(ICON_MAX_BYTES + 1)], "a.png", {
      type: "image/png",
    });
    expect(issuePaths(valid({ icon: big }))).toContain("icon");
    const ok = new File(["x"], "a.webp", { type: "image/webp" });
    expect(issuePaths(valid({ icon: ok }))).toEqual([]);
  });
});

describe("parsePatterns", () => {
  it("splits lines, trims and drops blanks", () => {
    expect(parsePatterns(" /a \n\n/b/*\n ")).toEqual(["/a", "/b/*"]);
  });
});
