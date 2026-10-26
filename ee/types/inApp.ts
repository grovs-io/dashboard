// Mirrors the backend's format 1 definition (ee/config/in_app/definition.schema.json).
import type {
  Conversion as InAppConversion,
  VariantId as InAppVariantId,
} from "@ee/types/experiment";

export const IN_APP_STATUSES = [
  "draft",
  "preparing",
  "scheduled",
  "live",
  "paused",
  "ended",
] as const;
export type InAppStatus = (typeof IN_APP_STATUSES)[number];

export const IN_APP_TEMPLATES = [
  "interstitial",
  "half_interstitial",
  "cover",
  "header",
  "footer",
  "alert",
  "interstitial_image",
  "half_interstitial_image",
  "cover_image",
  "html",
] as const;
export type InAppTemplate = (typeof IN_APP_TEMPLATES)[number];

export const IN_APP_LAYOUTS = [
  "full",
  "modal",
  "banner_top",
  "banner_bottom",
] as const;
export type InAppLayout = (typeof IN_APP_LAYOUTS)[number];

export const IN_APP_ORIENTATIONS = ["any", "portrait", "landscape"] as const;
export type InAppOrientation = (typeof IN_APP_ORIENTATIONS)[number];

export const IN_APP_ACTIONS = [
  "close",
  "open_url",
  "key_value",
  "request_push_permission",
  "request_app_rating",
  "open_store",
] as const;
export type InAppActionType = (typeof IN_APP_ACTIONS)[number];

export interface InAppAction {
  type: InAppActionType;
  url?: string;
  payload?: Record<string, string>;
}

export interface InAppButton {
  id: string;
  text: string;
  action: InAppAction;
  colors?: { background?: string; text?: string };
}

export const IN_APP_QUESTION_TYPES = ["stars", "choice"] as const;
export type InAppQuestionType = (typeof IN_APP_QUESTION_TYPES)[number];

export interface InAppQuestion {
  id: string;
  type: InAppQuestionType;
  options: { id: string; text: string }[];
  // With a split, an answer at or below it is asked low, one above it high.
  comment: {
    split: number | null;
    low: string | null;
    high: string | null;
  } | null;
  thanks: string | null;
  review_from: number | null;
}

export interface InAppContent {
  title?: string | null;
  message?: string | null;
  image?: { portrait: string | null; landscape: string | null };
  colors?: { background?: string; title?: string; message?: string };
  close_button?: boolean;
  dismissible?: boolean;
  backdrop?: "dim" | "none";
  buttons?: InAppButton[];
  tap_action?: InAppAction | null;
  question?: InAppQuestion | null;
  // Template html only.
  html?: string;
  layout?: InAppLayout;
  // Absent means any; a restricted message shows only in that orientation.
  orientation?: InAppOrientation;
}

export type InAppValueOp =
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "between"
  | "contains"
  | "not_contains"
  | "is_set"
  | "is_not_set";

export type InAppScalar = string | number | boolean;

export interface InAppFilter {
  field: string;
  op: InAppValueOp;
  value?: InAppScalar | [number, number];
}

export type InAppTrigger =
  | { type: "app_open" }
  | { type: "screen_view"; name?: string }
  | { type: "event"; name: string; filters?: InAppFilter[] };

export type InAppConditionType =
  | "platform"
  | "language"
  | "app_version"
  | "os_version"
  | "event_count"
  | "user_attribute"
  | "first_seen";

export interface InAppCondition {
  type: InAppConditionType;
  op: string;
  value?: InAppScalar | [number, number] | [string, string];
  name?: string;
  key?: string;
}

export interface InAppCaps {
  session?: number | null;
  day?: number | null;
  week?: number | null;
  lifetime?: number | null;
  ignore_global?: boolean;
}

export interface InAppSchedule {
  days?: number[] | null;
  from?: string | null;
  to?: string | null;
}

export type InAppAudienceInput =
  | { type: "all" }
  | { type: "segment"; segment_id: string };

export type {
  Conversion as InAppConversion,
  ConversionWindow as InAppConversionWindow,
  VariantId as InAppVariantId,
  ExperimentGroupId as InAppExperimentGroupId,
  ExperimentGroup as InAppExperimentGroup,
  Experiment as InAppExperiment,
} from "@ee/types/experiment";
export {
  CONVERSION_WINDOWS,
  VARIANT_IDS,
  conversionOf,
  goalKind,
  goalName,
} from "@ee/types/experiment";

// Variant A is the campaign's own content.
export interface InAppVariant {
  id: InAppVariantId;
  content: InAppContent;
}

export interface InAppCampaignInput {
  name?: string;
  template?: InAppTemplate;
  content?: InAppContent;
  triggers?: InAppTrigger[];
  conditions?: InAppCondition[];
  caps?: InAppCaps;
  schedule?: InAppSchedule;
  priority?: number;
  delay_seconds?: number;
  start_at?: string | null;
  end_at?: string | null;
  audience?: InAppAudienceInput;
  control_group?: number | null;
  conversion?: InAppConversion | null;
  variants?: InAppVariant[] | null;
  /** The version the editor loaded; a save from an older one is refused. */
  lock_version?: number;
}

export interface InAppCampaign {
  id: string;
  name: string;
  status: InAppStatus;
  revision: number;
  lock_version: number;
  template: InAppTemplate;
  content: InAppContent;
  triggers: InAppTrigger[];
  conditions: InAppCondition[];
  caps: InAppCaps;
  schedule: InAppSchedule;
  priority: number;
  delay_seconds: number;
  start_at: string | null;
  end_at: string | null;
  launched_at: string | null;
  ended_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  audience: {
    // "journey": a journey step's message, changed only through its journey.
    type: "all" | "segment" | "journey";
    segment_id: string | null;
    segment_definition_hash: string | null;
    segment_changed: boolean;
  };
  // Percent of the audience kept from the message, 1 to 50. Fixed after launch.
  control_group: number | null;
  conversion: InAppConversion | null;
  // Number and ids fixed after launch; content stays editable.
  variants: InAppVariant[] | null;
}

export interface InAppCounts {
  views: number;
  clicks: number;
  dismissals: number;
}

export interface InAppComment {
  // The number of stars, or the id of the option.
  value: string;
  comment: string;
  at: string;
  platform: string;
}

export interface InAppCommentsPage {
  comments: InAppComment[];
  next_before: string | null;
}

export interface InAppAnswers {
  type: InAppQuestionType;
  count: number;
  score: number | null;
  // `comments` is how many of the answers came with a comment.
  values: {
    value: number | string;
    label: string;
    count: number;
    comments: number;
  }[];
}

export interface InAppAnswerRow {
  at: string;
  platform: string;
  country: string;
  app_version: string;
  // The number of stars, or the id of the option.
  answer: string;
  label: string;
  comment: string;
  user: string | null;
}

export interface InAppAnswersExport {
  type: InAppQuestionType;
  truncated: boolean;
  rows: InAppAnswerRow[];
}

export interface InAppReport {
  totals: InAppCounts & {
    unique_viewers: number;
    unique_clickers: number;
    click_rate: number;
  };
  trend: (InAppCounts & { bucket: string })[];
  platforms: (InAppCounts & { platform: string })[];
  buttons: { button_id: string | null; clicks: number }[];
  eligible_devices: number | null;
  answers?: InAppAnswers | null;
}

export interface InAppSettings {
  enabled: boolean;
  session_cap: number;
  day_cap: number;
  // Percent of people who get no in-app message at all, 0 to 20.
  control_group: number;
  // Pushes per person per day across campaigns and journeys, 1 to 50; null is no limit.
  push_daily_cap?: number | null;
}

// A file a custom HTML message plays or shows; `used` when the saved HTML holds its URL.
export interface InAppMedia {
  id: string;
  url: string;
  type: string;
  bytes: number;
  used: boolean;
}

export type InAppImageSlot = "portrait" | "landscape";
export type InAppStep = "launch" | "pause" | "resume" | "end";
