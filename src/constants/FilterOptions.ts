import {
  ANDROID,
  GOOGLE,
  IOS,
  LINKEDIN,
  META,
  QUICK_LINK,
  TIKTOK,
  WEB,
} from "./OptionsConstants";

export interface FilterOption {
  label: string;
  value: string;
  filterType?: string;
}

export const adsFilterList: FilterOption[] = [
  { label: "Quick Links", value: QUICK_LINK },
  { label: "Google", value: GOOGLE },
  { label: "Meta ", value: META },
  { label: "LinkedIn", value: LINKEDIN },
  { label: "TikTok", value: TIKTOK },
  { label: "All", value: "", filterType: "ads" },
] as const;

export const platformsFilterList: FilterOption[] = [
  { label: "iOS ", value: IOS },
  { label: "Android", value: ANDROID },
  { label: "Web", value: WEB },
  { label: "All", value: "", filterType: "platforms" },
] as const;
