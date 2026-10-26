// Shared by in-app and push campaigns: the same fields, the same report.
export const CONVERSION_WINDOWS = [24, 72, 168] as const;
// A purchase often comes later than a tap, so its goal may wait 30 days.
export const PURCHASE_WINDOWS = [24, 72, 168, 720] as const;
export type ConversionWindow = (typeof PURCHASE_WINDOWS)[number];

export type GoalKind = "event" | "screen" | "system" | "purchase";

// Events the SDKs record by themselves, offered as "Built-in".
export const SYSTEM_EVENTS = [
  "install",
  "reinstall",
  "app_open",
  "open",
  "view",
  "reactivation",
] as const;
export type SystemEvent = (typeof SYSTEM_EVENTS)[number];

export const SYSTEM_EVENT_INFO: Record<
  SystemEvent,
  { label: string; verb: string; third: string }
> = {
  install: {
    label: "App installed",
    verb: "install the app",
    third: "installs the app",
  },
  reinstall: {
    label: "App reinstalled",
    verb: "reinstall the app",
    third: "reinstalls the app",
  },
  app_open: {
    label: "App opened",
    verb: "open the app",
    third: "opens the app",
  },
  open: { label: "Link opened", verb: "open a link", third: "opens a link" },
  view: { label: "Link viewed", verb: "view a link", third: "views a link" },
  reactivation: { label: "Came back", verb: "come back", third: "comes back" },
};

export const isSystemEvent = (v: unknown): v is SystemEvent =>
  typeof v === "string" && v in SYSTEM_EVENT_INFO;

// Exactly one of `event`, `screen`, `system` or `purchase`; `products` only with `purchase`.
export interface Conversion {
  event?: string;
  screen?: string;
  system?: SystemEvent;
  purchase?: true;
  products?: string[];
  window_hours: ConversionWindow;
}

// Written by the server or the SDK for the message itself; never a goal.
export const MESSAGE_EVENTS = [
  "in_app_viewed",
  "in_app_clicked",
  "in_app_dismissed",
  "in_app_answered",
  "in_app_commented",
  "in_app_held",
  "push_open",
  "push_delivered",
  "push_held",
] as const;

export const goalKind = (goal: Conversion): GoalKind =>
  goal.purchase
    ? "purchase"
    : goal.screen !== undefined
      ? "screen"
      : goal.system !== undefined
        ? "system"
        : "event";

export const goalName = (goal: Conversion): string =>
  goal.screen ?? goal.system ?? goal.event ?? "";

export const conversionOf = (
  kind: Exclude<GoalKind, "purchase">,
  name: string,
  window_hours: ConversionWindow
): Conversion =>
  kind === "screen"
    ? { screen: name, window_hours }
    : kind === "system" && isSystemEvent(name)
      ? { system: name, window_hours }
      : { event: name, window_hours };

export const purchaseGoal = (
  products: string[],
  window_hours: ConversionWindow
): Conversion =>
  products.length
    ? { purchase: true, products, window_hours }
    : { purchase: true, window_hours };

// A purchase needs no name, but "only these products" needs one; every other goal needs a name.
export const goalReady = (goal: Conversion): boolean =>
  goal.purchase === true
    ? goal.products === undefined || goal.products.length > 0
    : goalName(goal).trim() !== "";

// What the server receives: names trimmed, an empty product list left out.
export const goalInput = (goal: Conversion): Conversion => {
  const kind = goalKind(goal);
  return kind === "purchase"
    ? purchaseGoal(goal.products ?? [], goal.window_hours)
    : conversionOf(kind, goalName(goal).trim(), goal.window_hours);
};

export const VARIANT_IDS = ["b", "c"] as const;
export type VariantId = (typeof VARIANT_IDS)[number];

export type ExperimentGroupId = "a" | VariantId | "control" | "project_control";

export interface ExperimentGroup {
  id: ExperimentGroupId;
  exposed: number;
  // Null for the control groups. Push: opened.
  clicked: number | null;
  click_rate: number | null;
  // Null without a goal.
  converted: number | null;
  conversion_rate: number | null;
  // Variants against A, as a probability; on click rate without a goal.
  confidence: number | null;
  // Net USD cents of purchases within the window after exposure; per person is null with nobody exposed.
  revenue_cents: number;
  revenue_per_person_cents: number | null;
}

export interface Experiment {
  goal: Conversion | null;
  control_group: number | null;
  project_control_group: number;
  test_share: number | null;
  groups: ExperimentGroup[];
  // All four null without a campaign control group or without a goal.
  lift: number | null;
  added_conversions: number | null;
  confidence: number | null;
  more_people_needed: number | null;
  // Variants against the campaign's control; null without one or with nobody on a side.
  revenue_lift: number | null;
  added_revenue_cents: number | null;
}
