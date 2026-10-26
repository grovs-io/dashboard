// Mirrors the journeys API contract (docs/plans/2026-09-30-journeys-design.md).
import type { Conversion, Experiment, SystemEvent } from "@ee/types/experiment";
import type {
  InAppCaps,
  InAppContent,
  InAppFilter,
  InAppTemplate,
  InAppTrigger,
} from "@ee/types/inApp";

export const JOURNEY_STATUSES = ["draft", "live", "paused", "ended"] as const;
export type JourneyStatus = (typeof JOURNEY_STATUSES)[number];

// Exactly one of `name` (a custom event), `screen` (a screen view) or `system` (built-in, no filters).
export interface JourneyEvent {
  name?: string | null;
  screen?: string | null;
  system?: SystemEvent | null;
  filters?: InAppFilter[];
}

export interface JourneyEntry {
  type: "event" | "segment";
  event: JourneyEvent | null;
  segment_id: string | null;
  audience_segment_id: string | null;
}

export interface JourneyReEntry {
  mode: "once" | "after_exit" | "after_days";
  days: number | null;
}

export type WaitUntil =
  | { kind: "event"; event: JourneyEvent }
  | { kind: "opened"; step: string }
  | { kind: "clicked"; step: string };

export interface WaitStep {
  id: string;
  type: "wait";
  minutes: number;
  until: WaitUntil | null;
  next: string | null;
  timeout_next: string | null;
}

export type AttributeOp =
  | "eq"
  | "neq"
  | "contains"
  | "exists"
  | "not_exists"
  | "gt"
  | "lt";

export type SplitCondition =
  | { kind: "event"; event: JourneyEvent; days: number; min_count: number }
  | { kind: "segment"; segment_id: string | null }
  | {
      kind: "attribute";
      key: string;
      op: AttributeOp;
      // The API may send numbers or booleans back.
      value?: string | number | boolean | null;
    }
  | { kind: "platform"; values: ("ios" | "android" | "web")[] };

export interface ConditionSplitStep {
  id: string;
  type: "split";
  mode: "condition";
  condition: SplitCondition;
  yes_next: string | null;
  no_next: string | null;
}

export interface PercentSplitStep {
  id: string;
  type: "split";
  mode: "percent";
  paths: { percent: number; next: string | null }[];
}

export type SplitStep = ConditionSplitStep | PercentSplitStep;

export interface PushStep {
  id: string;
  type: "push";
  title: string;
  body: string;
  link_id: number | null;
  image_url: string | null;
  data: Record<string, unknown>;
  sound: string | null;
  quiet_hours: boolean;
  // Read-only: the push campaign the step sends through.
  campaign_id?: string | null;
  next: string | null;
}

export interface InAppJourneyStep {
  id: string;
  type: "in_app";
  template: InAppTemplate;
  content: InAppContent;
  triggers: InAppTrigger[];
  caps: InAppCaps;
  valid_days: number;
  campaign_id?: string | null;
  next: string | null;
}

export interface SetAttributeStep {
  id: string;
  type: "set_attribute";
  key: string;
  value: string;
  next: string | null;
}

export type JourneyStep =
  | WaitStep
  | SplitStep
  | PushStep
  | InAppJourneyStep
  | SetAttributeStep;
export type StepType = JourneyStep["type"];

// What the builder edits and the API takes.
export interface JourneyInput {
  name: string;
  entry: JourneyEntry;
  re_entry: JourneyReEntry;
  goals: Conversion[];
  control_group: number | null;
  start_at: string | null;
  end_at: string | null;
  first_step: string | null;
  steps: Record<string, JourneyStep>;
  lock_version?: number;
}

export interface Journey extends JourneyInput {
  id: string;
  status: JourneyStatus;
  revision: number;
  lock_version: number;
  stats?: { active: number; entered: number };
  launched_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

// List rows come without their steps.
export type JourneyRow = Omit<Journey, "steps">;

export type JourneyAction = "launch" | "pause" | "resume" | "end";

// `next`, `timeout_next`, `yes_next`, `no_next`, `path_0`…`path_2`.
export type BranchKey = string;

export interface JourneyStepCounts {
  reached: number;
  now: number;
  branches: Record<BranchKey, number>;
}

export interface JourneyReport {
  entered: number;
  held: number;
  active: number;
  left: { finished: number; goal: number; expired: number };
  steps: Record<string, JourneyStepCounts>;
  goal: Experiment | null;
  // Keyed by percent-split step id. Older backends omit it; treat as {}.
  paths?: Record<string, Experiment>;
}
