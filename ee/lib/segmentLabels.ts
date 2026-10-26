const PLATFORMS: Record<string, string> = {
  ios: "iOS",
  android: "Android",
  web: "Web",
  mac: "macOS",
  desktop: "Desktop",
  windows: "Windows",
};

const EVENT_TYPES: Record<string, string> = {
  app_open: "App open",
  view: "Link view",
  open: "Link open",
  install: "Install",
  reinstall: "Reinstall",
  time_spent: "Time spent",
  reactivation: "Reactivation",
  user_referred: "User referred",
  screen_view: "Screen view",
  custom: "Custom event",
  push_open: "Push open",
};

const FIELDS: Record<string, string> = {
  platform: "Platform",
  os: "OS",
  os_version: "OS version",
  app_version: "App version",
  device_model: "Device model",
  language: "Language",
  country: "Country",
  city: "City",
  screen_name: "Screen",
  event_name: "Event name",
  tracking_source: "Tracking source",
  tracking_medium: "Tracking medium",
  tracking_campaign: "Tracking campaign",
  ads_platform: "Ads platform",
  link_id: "Link",
  campaign_id: "Campaign",
  sdk_identifier: "Identifier",
};

let regionNames: Intl.DisplayNames | null | undefined;
function countryLabel(code: string): string {
  if (!/^[A-Z]{2}$/i.test(code)) return code;
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      regionNames = null;
    }
  }
  try {
    return regionNames?.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

let languageNames: Intl.DisplayNames | null | undefined;
function languageLabel(code: string): string {
  if (!/^[a-z]{2}(-[A-Za-z]{2})?$/.test(code)) return code;
  if (languageNames === undefined) {
    try {
      languageNames = new Intl.DisplayNames(["en"], { type: "language" });
    } catch {
      languageNames = null;
    }
  }
  try {
    return languageNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

export const humanize = (s: string) => s.replace(/_/g, " ");
export const platformLabel = (v: string) => PLATFORMS[v] ?? v;
export const eventTypeLabel = (v: string) =>
  EVENT_TYPES[v] ?? v.replace(/_/g, " ");
export const fieldLabel = (f: string) =>
  f.startsWith("properties.")
    ? f.slice("properties.".length)
    : (FIELDS[f] ?? f.replace(/_/g, " "));

// Display label for a raw value of an event/device column; ids and free text fall through unchanged.
export function valueLabel(field: string, value: string | number): string {
  const v = String(value);
  switch (field) {
    case "platform":
      return platformLabel(v);
    case "country":
      return countryLabel(v);
    case "language":
      return languageLabel(v);
    case "event_type":
      return eventTypeLabel(v);
    default:
      return v;
  }
}
