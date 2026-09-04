import { describe, expect, it } from "vitest";
import { disableEditButton, hasEditChanges } from "../useLinkEditValidation";
import type { LinkEditFormValues } from "../useLinkEditValidation";
import { LINK, QUICK_LINK } from "@/constants/OptionsConstants";
import type { Link } from "@/types";

const link: Link = {
  id: "1",
  name: "Migrated from branch",
  path: "f22169",
  active: true,
  ads_platform: QUICK_LINK,
  tags: [],
  ios_custom_redirect: null,
  android_custom_redirect: null,
  desktop_custom_redirect: null,
  total_views: 0,
  total_opens: 0,
  total_installs: 0,
  total_reinstalls: 0,
  total_reactivations: 0,
  total_time_spent: 0,
  total_revenue: 0,
  updated_at: "2026-08-24T00:00:00Z",
  created_at: "2026-08-24T00:00:00Z",
};

// Mirrors what initializeFromLink() puts in the form when the dialog opens.
const formFor = (source: Link): LinkEditFormValues => ({
  name: source.name ?? "",
  path: source.path ?? "",
  linkType: source.ads_platform ?? QUICK_LINK,
  socialMediaTitle: source.title ?? "",
  socialMediaSubTitle: source.subtitle ?? "",
  imageType: LINK,
  imageFile: undefined,
  imageLink: source.image ?? "",
  tagList: source.tags ?? [],
  iOSRedirectURL: source.ios_custom_redirect ?? null,
  iOSRedirectType: "default",
  androidRedirectURL: source.android_custom_redirect ?? null,
  androidRedirectType: "default",
  desktopRedirectURL: source.desktop_custom_redirect ?? null,
  desktopRedirectType: "default",
  showPreviewIOS: source.show_preview_ios ?? null,
  showPreviewAndroid: source.show_preview_android ?? null,
  copyToClipboardIOS: source.copy_to_clipboard_ios ?? null,
  copyToClipboardAndroid: source.copy_to_clipboard_android ?? null,
  utmCampaign: source.tracking_campaign ?? "",
  utmMedium: source.tracking_medium ?? "",
  utmSource: source.tracking_source ?? "",
  keyValuePair: [],
  pathAvailable: true,
});

describe("hasEditChanges", () => {
  it("reports no changes for a freshly opened link", () => {
    expect(hasEditChanges(formFor(link), link, [])).toBe(false);
  });

  // Migrated links are created server-side without an ads_platform, so the API
  // sends null. The form hydrates that to QUICK_LINK — the comparison has to
  // hydrate it the same way or the dialog opens dirty.
  it("reports no changes when the link has no ads_platform", () => {
    const migrated = { ...link, ads_platform: null };

    expect(hasEditChanges(formFor(migrated), migrated, [])).toBe(false);
  });

  it("treats a missing redirect key as no redirect", () => {
    const { ios_custom_redirect, ...withoutIos } = link;
    void ios_custom_redirect;

    expect(hasEditChanges(formFor(withoutIos), withoutIos, [])).toBe(false);
  });

  it("still reports a real link type change", () => {
    const form = { ...formFor(link), linkType: "google" };

    expect(hasEditChanges(form, link, [])).toBe(true);
  });

  // A link with no override inherits the project preview setting, so pinning it
  // to "skip preview" is a real edit even though both sides look falsy.
  it("reports switching the preview from inherited to an explicit skip", () => {
    const form = { ...formFor(link), showPreviewIOS: false };

    expect(hasEditChanges(form, link, [])).toBe(true);
  });

  it("reports switching the preview back from an explicit skip to inherited", () => {
    const explicit = { ...link, show_preview_ios: false };
    const form = { ...formFor(explicit), showPreviewIOS: null };

    expect(hasEditChanges(form, explicit, [])).toBe(true);
  });

  it("reports turning the clipboard copy off against an inherited default", () => {
    const form = { ...formFor(link), copyToClipboardAndroid: false };

    expect(hasEditChanges(form, link, [])).toBe(true);
  });

  it("reports no change when both preview values are inherited", () => {
    const form = { ...formFor(link), showPreviewIOS: null };

    expect(hasEditChanges(form, link, [])).toBe(false);
  });
});

describe("disableEditButton", () => {
  it("keeps save disabled for a migrated link with no edits", () => {
    const migrated = { ...link, ads_platform: null };

    expect(disableEditButton(formFor(migrated), migrated, [])).toBe(true);
  });

  it("enables save when the preview is pinned to an explicit skip", () => {
    const form = { ...formFor(link), showPreviewIOS: false };

    expect(disableEditButton(form, link, [])).toBe(false);
  });
});
