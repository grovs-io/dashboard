import { arrayMove } from "@dnd-kit/sortable";
import {
  parsePatterns,
  type SmartBannerFormValues,
} from "@/schemas/smartBanner";
import type {
  SmartBanner,
  SmartBannerState,
  SmartBannerStats,
  SmartBannersStatus,
} from "@/types";

export const bannerToFormValues = (b: SmartBanner): SmartBannerFormValues => ({
  name: b.name,
  platforms: b.platforms,
  all_pages: b.url_include.length === 0,
  url_include: b.url_include.join("\n"),
  url_exclude: b.url_exclude.join("\n"),
  position: b.position,
  title: b.title,
  subtitle: b.subtitle ?? "",
  button_text: b.button_text,
  background_color: b.background_color,
  text_color: b.text_color,
  button_color: b.button_color,
  button_text_color: b.button_text_color,
  dismiss_days: b.dismiss_days,
  open_hide_days: b.open_hide_days,
  icon: null,
  remove_icon: false,
});

const key = (field: string) => `smart_banner[${field}]`;

// Empty arrays go as one blank entry; the backend drops blanks.
const appendArray = (fd: FormData, field: string, values: string[]) => {
  const list = values.length ? values : [""];
  list.forEach((v) => fd.append(`${key(field)}[]`, v));
};

// Status goes only when the save also publishes or keeps a draft.
export const buildSmartBannerFormData = (
  v: SmartBannerFormValues,
  status?: SmartBannerState
): FormData => {
  const fd = new FormData();
  fd.append(key("name"), v.name.trim());
  if (status) fd.append(key("status"), status);
  appendArray(fd, "platforms", v.platforms);
  appendArray(
    fd,
    "url_include",
    v.all_pages ? [] : parsePatterns(v.url_include)
  );
  appendArray(fd, "url_exclude", parsePatterns(v.url_exclude));
  fd.append(key("position"), v.position);
  fd.append(key("title"), v.title.trim());
  fd.append(key("subtitle"), v.subtitle.trim());
  fd.append(key("button_text"), v.button_text.trim());
  fd.append(key("background_color"), v.background_color);
  fd.append(key("text_color"), v.text_color);
  fd.append(key("button_color"), v.button_color);
  fd.append(key("button_text_color"), v.button_text_color);
  fd.append(key("dismiss_days"), String(v.dismiss_days));
  fd.append(key("open_hide_days"), String(v.open_hide_days));
  if (v.icon) fd.append(key("icon"), v.icon);
  else if (v.remove_icon) fd.append(key("remove_icon"), "true");
  return fd;
};

export const buildStatusFormData = (status: SmartBannerState): FormData => {
  const fd = new FormData();
  fd.append(key("status"), status);
  return fd;
};

export const moveId = (
  ids: number[],
  activeId: number,
  overId: number
): number[] => {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from < 0 || to < 0) return ids;
  return arrayMove(ids, from, to);
};

export const moveToEdge = (
  ids: number[],
  id: number,
  edge: "top" | "bottom"
): number[] => {
  const rest = ids.filter((x) => x !== id);
  return edge === "top" ? [id, ...rest] : [...rest, id];
};

// Archived banners have no priority; the rest keep the server's order.
export const prioritised = (banners: SmartBanner[]): SmartBanner[] =>
  banners.filter((b) => b.status !== "archived");

export const formatCtr = (ctr: number): string => `${(ctr * 100).toFixed(1)}%`;

// Dismisses over views; undefined (shown as "-") when there were no views.
export const dismissRate = (
  dismisses: number,
  views: number
): number | undefined => (views ? dismisses / views : undefined);

export const smartBannerSnippet = (
  apiKey: string,
  testEnvironment: boolean
): string => `import Grovs from "grovs";

Grovs.configure({ apiKey: "${apiKey}"${testEnvironment ? ", testEnvironment: true" : ""} });

// Optional, per page: the data the app receives when the banner opens it
Grovs.smartBanner.setLinkData({ data: { productId: "123" } });`;

export const SMART_BANNER_CSS_SNIPPET = `/* Keep fixed headers below a top banner */
.site-header {
  top: var(--grovs-smart-banner-top, 0);
}`;

// Integrated once a website domain is linked or the SDK has been seen; last-seen is informational.
export type SmartBannerSetupStage = "domain" | "ready";

export const isIntegrated = (s: SmartBannersStatus | undefined): boolean =>
  !!s &&
  ((s.web_configured && s.domains.length > 0) || s.sdk_last_seen_at !== null);

export const setupStage = (s: SmartBannersStatus): SmartBannerSetupStage =>
  isIntegrated(s) ? "ready" : "domain";

export type SmartBannerDisplayStatus = SmartBannerState | "not_live";

// A live banner without a default link is not served.
export const bannerDisplayStatus = (
  b: Pick<SmartBanner, "status" | "default_link">
): SmartBannerDisplayStatus =>
  b.status === "live" && b.default_link === null ? "not_live" : b.status;

export type SmartBannerAction =
  | "publish"
  | "pause"
  | "resume"
  | "edit"
  | "duplicate"
  | "archive"
  | "restore"
  | "delete";

export const BANNER_ACTIONS: Record<SmartBannerState, SmartBannerAction[]> = {
  draft: ["publish", "edit", "duplicate", "delete"],
  live: ["pause", "edit", "duplicate", "archive"],
  paused: ["resume", "edit", "duplicate", "archive", "delete"],
  archived: ["restore", "duplicate", "delete"],
};

// The status each status-changing action writes.
export const ACTION_STATUS: Partial<
  Record<SmartBannerAction, SmartBannerState>
> = {
  publish: "live",
  pause: "paused",
  resume: "live",
  archive: "archived",
  restore: "paused",
};

export const sumStats = (
  banners: SmartBanner[]
): Pick<
  SmartBannerStats,
  "views" | "clicks" | "dismisses" | "ctr" | "installs"
> => {
  const t = banners.reduce(
    (acc, b) => ({
      views: acc.views + b.stats.views,
      clicks: acc.clicks + b.stats.clicks,
      dismisses: acc.dismisses + b.stats.dismisses,
      installs: acc.installs + b.stats.installs,
    }),
    { views: 0, clicks: 0, dismisses: 0, installs: 0 }
  );
  return { ...t, ctr: t.views ? t.clicks / t.views : 0 };
};

// "" is every banner except archived ones.
export type SmartBannerStatusFilter = "" | SmartBannerState;
export type SmartBannerFilters = {
  term: string;
  status: SmartBannerStatusFilter;
  platform: "" | SmartBanner["platforms"][number];
};

export const filterBanners = (
  banners: SmartBanner[],
  f: SmartBannerFilters
): SmartBanner[] => {
  const term = f.term.trim().toLowerCase();
  return banners.filter(
    (b) =>
      (!term ||
        b.name.toLowerCase().includes(term) ||
        b.title.toLowerCase().includes(term)) &&
      (f.status ? b.status === f.status : b.status !== "archived") &&
      (!f.platform || b.platforms.includes(f.platform))
  );
};
