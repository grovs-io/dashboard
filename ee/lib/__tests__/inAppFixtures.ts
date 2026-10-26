import type {
  InAppAnswers,
  InAppCampaign,
  InAppExperiment,
  InAppQuestion,
  InAppReport,
} from "@ee/types/inApp";

export const inAppCampaign = (
  over: Partial<InAppCampaign> = {}
): InAppCampaign => ({
  id: "LXyFdO",
  name: "Autumn sale",
  status: "draft",
  revision: 1,
  lock_version: 0,
  template: "interstitial",
  content: { title: "Hello", message: "Welcome" },
  triggers: [{ type: "event", name: "cart_viewed" }],
  conditions: [],
  caps: { lifetime: 3 },
  schedule: {},
  priority: 4,
  delay_seconds: 0,
  start_at: null,
  end_at: null,
  launched_at: null,
  ended_at: null,
  failure_reason: null,
  created_at: "2026-09-28T10:00:00.000Z",
  updated_at: "2026-09-28T10:00:00.000Z",
  audience: {
    type: "all",
    segment_id: null,
    segment_definition_hash: null,
    segment_changed: false,
  },
  control_group: null,
  conversion: null,
  variants: null,
  ...over,
});

export const starsQuestion: InAppQuestion = {
  id: "q1",
  type: "stars",
  options: [],
  comment: { split: 3, low: "What could be better?", high: null },
  thanks: "Thank you",
  review_from: 4,
};

export const questionCampaign = (
  over: Partial<InAppCampaign> = {}
): InAppCampaign =>
  inAppCampaign({
    id: "ask-1",
    name: "Rate the app",
    template: "footer",
    content: { title: "Enjoying the app?", question: starsQuestion },
    ...over,
  });

export const inAppReport = (
  answers: InAppReport["answers"] = null
): InAppReport => ({
  totals: {
    views: 40,
    clicks: 0,
    dismissals: 12,
    unique_viewers: 38,
    unique_clickers: 0,
    click_rate: 0,
  },
  trend: [{ bucket: "2026-09-20", views: 40, clicks: 0, dismissals: 12 }],
  platforms: [{ platform: "ios", views: 40, clicks: 0, dismissals: 12 }],
  buttons: [],
  eligible_devices: null,
  answers,
});

export const starsAnswers: InAppAnswers = {
  type: "stars",
  count: 6,
  score: 4.17,
  values: [
    { value: 1, label: "1", count: 0, comments: 0 },
    { value: 2, label: "2", count: 1, comments: 1 },
    { value: 3, label: "3", count: 0, comments: 0 },
    { value: 4, label: "4", count: 2, comments: 0 },
    { value: 5, label: "5", count: 3, comments: 1 },
  ],
};

export const choiceAnswers: InAppAnswers = {
  type: "choice",
  count: 4,
  score: null,
  values: [
    { value: "search", label: "Search", count: 3, comments: 0 },
    { value: "offline", label: "Offline mode", count: 1, comments: 0 },
  ],
};

// A live campaign with a goal, a control group and one variant.
export const experimentCampaign = (
  over: Partial<InAppCampaign> = {}
): InAppCampaign =>
  inAppCampaign({
    id: "exp-1",
    name: "Autumn sale test",
    status: "live",
    launched_at: "2026-09-20T10:00:00.000Z",
    control_group: 10,
    conversion: { event: "checkout", window_hours: 72 },
    variants: [{ id: "b", content: { title: "Hi", message: "Sale on" } }],
    ...over,
  });

export const inAppExperiment = (
  over: Partial<InAppExperiment> = {}
): InAppExperiment => ({
  goal: { event: "checkout", window_hours: 72 },
  control_group: 10,
  project_control_group: 5,
  test_share: null,
  groups: [
    {
      id: "a",
      exposed: 4120,
      clicked: 610,
      click_rate: 0.148,
      converted: 233,
      conversion_rate: 0.0566,
      confidence: null,
      revenue_cents: 412000,
      revenue_per_person_cents: 100,
    },
    {
      id: "b",
      exposed: 4098,
      clicked: 702,
      click_rate: 0.1713,
      converted: 268,
      conversion_rate: 0.0654,
      confidence: 0.96,
      revenue_cents: 409800,
      revenue_per_person_cents: 100,
    },
    {
      id: "control",
      exposed: 910,
      clicked: null,
      click_rate: null,
      converted: 31,
      conversion_rate: 0.0341,
      confidence: null,
      revenue_cents: 77350,
      revenue_per_person_cents: 85,
    },
    {
      id: "project_control",
      exposed: 455,
      clicked: null,
      click_rate: null,
      converted: 14,
      conversion_rate: 0.0308,
      confidence: null,
      revenue_cents: 0,
      revenue_per_person_cents: 0,
    },
  ],
  lift: 0.83,
  added_conversions: 47,
  confidence: 0.99,
  more_people_needed: null,
  revenue_lift: 0.18,
  added_revenue_cents: 124000,
  ...over,
});
