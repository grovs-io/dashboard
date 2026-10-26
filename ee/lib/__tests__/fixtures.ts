import type { SegmentCatalogue } from "@ee/types/segments";

export const catalogue: SegmentCatalogue = {
  version: 1,
  limits: {
    groups: 5,
    conditions_per_group: 10,
    filters: 25,
    values: 100,
    value_bytes: 256,
    identifier_list: 200_000,
  },
  conditions: [
    {
      type: "event",
      event_types: ["app_open", "view"],
      filter_columns: ["platform", "country"],
      filter_ops: ["is", "is_not", "contains"],
      property_prefix: "properties.",
      max_window_days: 90,
      negatable: true,
    },
    {
      type: "device",
      fields: ["platform", "os"],
      ops: ["is", "is_not", "contains"],
      modes: ["current", "used"],
      current_window_days: 30,
      max_window_days: 90,
    },
    {
      type: "profile",
      ops: ["is", "is_not", "contains", "is_set", "is_not_set"],
      property_prefix: "properties.",
      property_keys: ["plan"],
    },
    { type: "first_seen", ops: ["gte", "lte"] },
    {
      type: "identifier",
      ops: ["is_set", "is_not_set", "is", "contains", "in_list", "not_in_list"],
      valueless_ops: ["is_set", "is_not_set", "in_list", "not_in_list"],
    },
    {
      type: "acquisition",
      id_fields: ["link_id", "campaign_id"],
      string_fields: ["tracking_source", "tracking_medium"],
      max_window_days: 365,
    },
    {
      type: "purchase",
      enabled: false,
      purchase_types: ["subscription", "one_time"],
      max_window_days: 365,
      negatable: true,
    },
  ],
};

// Instance configurations with iOS and Android push both set up.
export const BOTH_CONFIGURED = [
  {
    platform: "ios",
    configuration: {
      bundle_id: "com.acme",
      app_prefix: "TEAM1",
      push_configuration: { configured: true },
    },
  },
  {
    platform: "android",
    configuration: { push_configuration: { firebase_project_id: "acme" } },
  },
];
