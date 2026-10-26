export type SmartBannerPlatform = "ios" | "android";
export type SmartBannerPosition = "top" | "bottom";
// Only live banners are served to the SDK.
export type SmartBannerState = "draft" | "live" | "paused" | "archived";

export interface SmartBannerStats {
  views: number;
  clicks: number;
  dismisses: number;
  ctr: number;
  opens: number;
  installs: number;
}

export interface SmartBanner {
  id: number;
  name: string;
  status: SmartBannerState;
  priority: number;
  platforms: SmartBannerPlatform[];
  url_include: string[];
  url_exclude: string[];
  position: SmartBannerPosition;
  title: string;
  subtitle: string | null;
  button_text: string;
  background_color: string;
  text_color: string;
  button_color: string;
  button_text_color: string;
  icon_url: string | null;
  dismiss_days: number;
  open_hide_days: number;
  default_link: string | null;
  created_at: string;
  updated_at: string;
  stats: SmartBannerStats;
}

export interface SmartBannersStatus {
  web_configured: boolean;
  domains: string[];
  sdk_last_seen_at: string | null;
}
