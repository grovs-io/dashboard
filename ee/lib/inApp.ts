import { ApiError } from "@/lib/ApiError";
import type { PlatformAppConfig } from "@/types/instance";
import { TONE_CLASSES, type PushStatusTone } from "@ee/lib/push";
import type {
  InAppActionType,
  InAppCampaign,
  InAppLayout,
  InAppOrientation,
  InAppStatus,
  InAppTemplate,
  InAppTrigger,
} from "@ee/types/inApp";

export { TONE_CLASSES };

const STATUS_LABELS: Record<InAppStatus, string> = {
  draft: "Draft",
  preparing: "Preparing audience",
  scheduled: "Scheduled",
  live: "Live",
  paused: "Paused",
  ended: "Ended",
};

const STATUS_TONES: Record<InAppStatus, PushStatusTone> = {
  draft: "grey",
  preparing: "blue",
  scheduled: "blue",
  live: "green",
  paused: "grey",
  ended: "grey",
};

export const inAppStatusLabel = (status: InAppStatus) => STATUS_LABELS[status];
export const inAppStatusTone = (status: InAppStatus) => STATUS_TONES[status];
export const isInAppStatus = (value: string): value is InAppStatus =>
  value in STATUS_LABELS;

export interface TemplateInfo {
  label: string;
  hint: string;
  imageOnly: boolean;
  image: boolean;
  banner: boolean;
  html: boolean;
}

export const TEMPLATES: Record<InAppTemplate, TemplateInfo> = {
  interstitial: info("Interstitial", "A card in the middle of the screen"),
  half_interstitial: info("Half interstitial", "A smaller card in the middle"),
  cover: info("Cover", "Fills the whole screen"),
  header: info("Header", "A banner at the top", { banner: true }),
  footer: info("Footer", "A banner at the bottom", { banner: true }),
  alert: info("Alert", "The system's own alert, text only", { image: false }),
  interstitial_image: info("Interstitial image", "Image only, centred", {
    imageOnly: true,
  }),
  half_interstitial_image: info("Half interstitial image", "Image only", {
    imageOnly: true,
  }),
  cover_image: info("Cover image", "Image only, full screen", {
    imageOnly: true,
  }),
  html: info("Custom HTML", "Your own page, with video and audio", {
    image: false,
    html: true,
  }),
};

export const HTML_TEMPLATE_NOTE =
  "Needs an app version with the new SDK; older versions skip this message.";

export const LAYOUT_LABELS: Record<InAppLayout, string> = {
  full: "Full screen",
  modal: "Card in the middle",
  banner_top: "Banner at the top",
  banner_bottom: "Banner at the bottom",
};

export const ORIENTATION_LABELS: Record<InAppOrientation, string> = {
  any: "Any orientation",
  portrait: "Portrait only",
  landscape: "Landscape only",
};

function info(
  label: string,
  hint: string,
  over: Partial<TemplateInfo> = {}
): TemplateInfo {
  return {
    label,
    hint,
    imageOnly: false,
    image: true,
    banner: false,
    html: false,
    ...over,
  };
}

export const ACTION_LABELS: Record<InAppActionType, string> = {
  close: "Close the message",
  open_url: "Open a link",
  key_value: "Send data to the app",
  request_push_permission: "Ask for push permission",
  request_app_rating: "Ask for an app rating",
  open_store: "Open the app's store page",
};

// What the web cannot do: a message with one of these is never shown to web visitors.
export const APP_ONLY_ACTIONS: readonly InAppActionType[] = [
  "request_push_permission",
  "request_app_rating",
  "open_store",
];

export function triggerLabel(trigger: InAppTrigger): string {
  if (trigger.type === "app_open") return "The app is opened";
  if (trigger.type === "screen_view")
    return trigger.name
      ? `Screen "${trigger.name}" is viewed`
      : "Any screen is viewed";
  const filters = trigger.filters?.length ?? 0;
  const suffix = filters ? ` (${filters} filter${filters > 1 ? "s" : ""})` : "";
  return `Event "${trigger.name}" happens${suffix}`;
}

const FAILURES: Record<string, string> = {
  audience_busy:
    "The audience could not be calculated in time. Launch it again in a few minutes.",
  segment_invalid:
    "The segment can no longer be evaluated. Choose another segment.",
  audience_error: "The audience could not be calculated. Launch it again.",
};

export const failureText = (reason: string | null) =>
  reason ? (FAILURES[reason] ?? "The launch did not complete.") : null;

// The server's own sentence is the most useful one: it names the field that is wrong.
export function inAppErrorText(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  const body =
    error.data && typeof error.data === "object" && "error" in error.data
      ? String((error.data as { error?: unknown }).error ?? "")
      : "";
  return body || error.message || fallback;
}

// A 404 alone can be a missing campaign; only this message means the feature is off.
export function isInAppNotEnabled(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 404 &&
    /not enabled/i.test(inAppErrorText(error, ""))
  );
}

export const canPause = (c: InAppCampaign) => c.status === "live";
export const canResume = (c: InAppCampaign) => c.status === "paused";
export const canEnd = (c: InAppCampaign) =>
  ["preparing", "scheduled", "live", "paused"].includes(c.status);
export const canEdit = (c: Pick<InAppCampaign, "status">) =>
  c.status !== "ended";

export function clickRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

// Only the first word of a label is a plain word; names inside it keep their letters.
const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

// One sentence that says what launching will do, for the review step.
export function launchSentence(
  template: InAppTemplate,
  triggers: InAppTrigger[],
  audience: string,
  startsLater: boolean
): string {
  const kind =
    template === "html"
      ? "custom HTML message"
      : TEMPLATES[template].label.toLowerCase();
  const article = /^[aeiou]/.test(kind) ? "An" : "A";
  const moments = triggers.map((t) => lower(triggerLabel(t))).join(", or ");
  const start = startsLater
    ? "from its start date"
    : "as soon as it is launched";
  return `${article} ${kind} shown to ${audience} when ${moments || "nothing yet"}, ${start}.`;
}

export interface InAppPlatforms {
  ios: boolean;
  android: boolean;
  web: boolean;
}

// Same checks as the Developers setup pages: an app or domain is registered for the platform.
export function inAppPlatforms(configs: PlatformAppConfig[]): InAppPlatforms {
  const find = (platform: string) =>
    (Array.isArray(configs) ? configs : []).find((c) => c.platform === platform)
      ?.configuration;
  return {
    ios: !!find("ios")?.bundle_id,
    android: !!find("android")?.identifier,
    web: (find("web")?.domains?.length ?? 0) > 0,
  };
}
