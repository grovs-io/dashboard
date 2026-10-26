/** Human labels for filter fields, shared by the QueryBar and widget filter chips. */
export const FIELD_LABELS: Record<string, string> = {
  event_type: "Event Type",
  event_name: "Event Name",
  screen_name: "Screen",
  visitor: "User",
  visitor_id: "User",
  session_id: "Session",
  platform: "Platform",
  app_version: "Version",
  device_model: "Device",
  os: "OS",
  os_version: "OS Version",
  country: "Country",
  city: "City",
  source: "Source",
  language: "Language",
  tracking_source: "Source",
  tracking_medium: "Medium",
  tracking_campaign: "UTM Campaign",
  campaign: "Campaign",
  campaign_id: "Campaign",
  link: "Link",
  link_id: "Link",
  ads_platform: "Ads Platform",
  sdk_identifier: "SDK",
};

export function toLabel(key: string): string {
  return key.replace(/[_.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function filterFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? toLabel(field);
}
