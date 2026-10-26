import type { SmartBanner, SmartBannersStatus } from "@/types";

export const makeBanner = (
  id: number,
  name: string,
  over: Partial<SmartBanner> = {}
): SmartBanner => ({
  id,
  name,
  status: "live",
  priority: id,
  platforms: ["ios"],
  url_include: [],
  url_exclude: [],
  position: "top",
  title: "Get the app",
  subtitle: null,
  button_text: "Open",
  background_color: "#FFFFFF",
  text_color: "#111827",
  button_color: "#2563EB",
  button_text_color: "#FFFFFF",
  icon_url: null,
  dismiss_days: 7,
  open_hide_days: 30,
  default_link: "https://x/abc",
  created_at: "",
  updated_at: "",
  stats: {
    views: 100,
    clicks: 10,
    dismisses: 0,
    ctr: 0.1,
    opens: 4,
    installs: 2,
  },
  ...over,
});

export const NOT_SET_UP: SmartBannersStatus = {
  web_configured: false,
  domains: [],
  sdk_last_seen_at: null,
};
export const DOMAIN_ONLY: SmartBannersStatus = {
  web_configured: true,
  domains: ["shop.com"],
  sdk_last_seen_at: null,
};
export const READY: SmartBannersStatus = {
  web_configured: true,
  domains: ["shop.com"],
  sdk_last_seen_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
};

// Radix's Switch thumb measures itself with ResizeObserver, which jsdom doesn't ship.
export function stubResizeObserver() {
  if (typeof globalThis.ResizeObserver !== "undefined") return;
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (
    globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }
  ).ResizeObserver = ResizeObserverStub;
}
