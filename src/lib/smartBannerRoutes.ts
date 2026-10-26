import { hrefWithParams, type PageSearchParams } from "@/lib/hrefWithParams";

// Kept apart from smartBanners.ts so server redirects avoid its client-only imports.
export const SMART_BANNERS_PATH = "/smart_banners";
// The list's query param that opens the composer: "new" or a banner id.
export const BANNER_PARAM = "banner";
export const bannerDialogHref = (
  target: string | number,
  params?: PageSearchParams
): string =>
  hrefWithParams(SMART_BANNERS_PATH, params, {
    [BANNER_PARAM]: String(target),
  });

// Anything else in the param leaves the dialog closed.
export const parseBannerParam = (raw: string): "new" | number | null =>
  raw === "new" ? "new" : /^\d+$/.test(raw) ? Number(raw) : null;
