import { createStep, emptyJourney } from "@ee/lib/journeys";
import type { Experiment } from "@ee/types/experiment";
import type {
  Journey,
  JourneyInput,
  JourneyReport,
  JourneyStep,
  PushStep,
} from "@ee/types/journey";

export const push = (id: string, next: string | null = null): PushStep => ({
  ...(createStep("push", id) as PushStep),
  title: "Your cart misses you",
  body: "Finish your order",
  campaign_id: `pc-${id}`,
  next,
});

// Cart recovery: wait for a checkout, push on timeout, wait for an open, then an in-app.
export const cartSteps = (): Record<string, JourneyStep> => ({
  s1: {
    id: "s1",
    type: "wait",
    minutes: 120,
    until: {
      kind: "event",
      event: { name: "checkout_completed", filters: [] },
    },
    next: null,
    timeout_next: "s2",
  },
  s2: push("s2", "s3"),
  s3: {
    id: "s3",
    type: "wait",
    minutes: 1440,
    until: { kind: "opened", step: "s2" },
    next: null,
    timeout_next: "s4",
  },
  s4: {
    ...(createStep("in_app", "s4") as Extract<JourneyStep, { type: "in_app" }>),
    content: { title: "10% off", message: "Use code CART10" },
    campaign_id: "ia-s4",
    next: "s5",
  },
  s5: {
    id: "s5",
    type: "set_attribute",
    key: "journey_nudged",
    value: "true",
    next: null,
  },
});

export const cartDraft = (): JourneyInput => ({
  ...emptyJourney(),
  name: "Cart recovery",
  entry: {
    type: "event",
    event: { name: "add_to_cart", filters: [] },
    segment_id: null,
    audience_segment_id: null,
  },
  goals: [{ event: "checkout_completed", window_hours: 168 }],
  control_group: 10,
  first_step: "s1",
  steps: cartSteps(),
});

// A split whose No path waits and then joins the Yes path's push.
export const joinDraft = (): JourneyInput => ({
  ...cartDraft(),
  first_step: "a",
  steps: {
    a: {
      id: "a",
      type: "split",
      mode: "condition",
      condition: { kind: "platform", values: ["ios"] },
      yes_next: "b",
      no_next: "c",
    },
    b: push("b", "d"),
    c: {
      id: "c",
      type: "wait",
      minutes: 60,
      until: null,
      next: "b",
      timeout_next: null,
    },
    d: {
      id: "d",
      type: "set_attribute",
      key: "journey_done",
      value: "1",
      next: null,
    },
  },
});

// A 50/30/20 percent split into the same push: exercises the A/B split result card.
export const abDraft = (): JourneyInput => ({
  ...cartDraft(),
  first_step: "a",
  steps: {
    a: {
      id: "a",
      type: "split",
      mode: "percent",
      paths: [
        { percent: 50, next: "b" },
        { percent: 30, next: "b" },
        { percent: 20, next: "b" },
      ],
    },
    b: push("b", null),
  },
});

// A split's a/b/c path groups, no control: for the A/B split result card.
export const pathExperiment = (over: Partial<Experiment> = {}): Experiment => ({
  goal: { event: "checkout_completed", window_hours: 168 },
  control_group: null,
  project_control_group: 0,
  test_share: null,
  groups: [
    {
      id: "a",
      exposed: 500,
      clicked: null,
      click_rate: null,
      converted: 50,
      conversion_rate: 0.1,
      confidence: null,
      revenue_cents: 0,
      revenue_per_person_cents: 0,
    },
    {
      id: "b",
      exposed: 300,
      clicked: null,
      click_rate: null,
      converted: 45,
      conversion_rate: 0.15,
      confidence: 0.97,
      revenue_cents: 0,
      revenue_per_person_cents: 0,
    },
    {
      id: "c",
      exposed: 200,
      clicked: null,
      click_rate: null,
      converted: 20,
      conversion_rate: 0.1,
      confidence: 0.5,
      revenue_cents: 0,
      revenue_per_person_cents: 0,
    },
  ],
  lift: null,
  added_conversions: null,
  confidence: null,
  more_people_needed: null,
  revenue_lift: null,
  added_revenue_cents: null,
  ...over,
});

export const journey = (over: Partial<Journey> = {}): Journey => ({
  ...cartDraft(),
  id: "jr1",
  status: "draft",
  revision: 1,
  lock_version: 0,
  launched_at: null,
  ended_at: null,
  created_at: "2026-09-28T10:00:00.000Z",
  updated_at: "2026-09-28T10:00:00.000Z",
  ...over,
});

export const journeyReport = (
  over: Partial<JourneyReport> = {}
): JourneyReport => ({
  entered: 4720,
  held: 590,
  active: 1204,
  left: { finished: 3200, goal: 700, expired: 206 },
  steps: {
    s1: {
      reached: 4720,
      now: 820,
      branches: { next: 1480, timeout_next: 2420 },
    },
    s2: { reached: 2420, now: 0, branches: { next: 2420 } },
    s3: {
      reached: 2420,
      now: 310,
      branches: { next: 640, timeout_next: 1470 },
    },
    s4: { reached: 1470, now: 74, branches: { next: 1396 } },
    s5: { reached: 1396, now: 0, branches: { next: 1396 } },
  },
  goal: {
    goal: { event: "checkout_completed", window_hours: 168 },
    control_group: 10,
    project_control_group: 0,
    test_share: null,
    groups: [
      {
        id: "a",
        exposed: 4720,
        clicked: null,
        click_rate: null,
        converted: 700,
        conversion_rate: 0.148,
        confidence: null,
        revenue_cents: 0,
        revenue_per_person_cents: 0,
      },
      {
        id: "control",
        exposed: 590,
        clicked: null,
        click_rate: null,
        converted: 62,
        conversion_rate: 0.105,
        confidence: null,
        revenue_cents: 0,
        revenue_per_person_cents: 0,
      },
    ],
    lift: 0.41,
    added_conversions: 204,
    confidence: 0.99,
    more_people_needed: null,
    revenue_lift: null,
    added_revenue_cents: null,
  },
  ...over,
});
