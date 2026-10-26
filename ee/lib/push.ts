import { format, parseISO } from "date-fns";
import { ApiError } from "@/lib/ApiError";
import { TONE_CLASSES, type StatusTone } from "@/lib/statusTone";
import type { PlatformAppConfig } from "@/types/instance";
import type {
  PushAudienceInput,
  PushCampaign,
  PushReport,
  PushCampaignInput,
  PushDeliveryStatus,
  PushEstimate,
  PushErrorCode,
  PushFailureReason,
  PushPlatform,
  PushStatus,
} from "@ee/types/push";

const encoder = new TextEncoder();
const byteLength = (value: string) => encoder.encode(value).length;

// Mirrors the backend's PushCampaign constants (ee/app/models/push_campaign.rb).
export const APNS_PAYLOAD_LIMIT_BYTES = 4096;
export const MAX_SCHEDULE_MS = 30 * 24 * 60 * 60 * 1000;
const EASTERNMOST_OFFSET_MS = 14 * 60 * 60 * 1000;

export const PUSH_STATUSES: readonly PushStatus[] = [
  "draft",
  "scheduled",
  "evaluating",
  "sending",
  "sent",
  "failed",
  "cancelled",
];

export function isPushStatus(value: string): value is PushStatus {
  return (PUSH_STATUSES as readonly string[]).includes(value);
}

export const CANCELLABLE_STATUSES: ReadonlySet<PushStatus> = new Set([
  "draft",
  "scheduled",
  "sending",
]);

// Also while the rest wait for a winner: cancelling drops them.
export const canCancel = (
  c: Pick<PushCampaign, "status" | "report" | "winner">
) => CANCELLABLE_STATUSES.has(c.status) || awaitingWinner(c);

const STATUS_LABELS: Record<PushStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  evaluating: "Evaluating",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function statusLabel(status: PushStatus): string {
  return STATUS_LABELS[status];
}

// The DOM id of the report's Experiment card, for the banner's "Choose a variant".
export const PUSH_EXPERIMENT_CARD_ID = "push-experiment";

// Sent to the test share, with people still waiting for a winner nobody has picked.
export const awaitingWinner = (
  c: Pick<PushCampaign, "status" | "winner"> & {
    report?: Pick<PushReport, "waiting">;
  }
) => c.status === "sent" && (c.report?.waiting ?? 0) > 0 && !c.winner;

// "2 h 57 min 43 s", "12 min 05 s", "42 s"; past due reads "any minute now".
export function untilLabel(
  date: Date | string,
  now: Date = new Date()
): string {
  const at = typeof date === "string" ? new Date(date) : date;
  const ms = at.getTime() - now.getTime();
  if (Number.isNaN(ms) || ms <= 0) return "any minute now";
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours} h ${minutes} min ${seconds} s`;
  if (minutes > 0)
    return `${minutes} min ${String(seconds).padStart(2, "0")} s`;
  return `${seconds} s`;
}

export type PushStatusTone = StatusTone;
export { TONE_CLASSES };

const STATUS_TONES: Record<PushStatus, PushStatusTone> = {
  draft: "grey",
  scheduled: "blue",
  evaluating: "blue",
  sending: "blue",
  sent: "green",
  failed: "red",
  cancelled: "grey",
};

export function statusTone(status: PushStatus): PushStatusTone {
  return STATUS_TONES[status];
}

const FAILURE_REASON_LABELS: Record<PushFailureReason, string> = {
  segment_busy: "Segment busy",
  segment_invalid: "Segment invalid",
  query_too_heavy: "Segment too heavy",
  evaluation_error: "Evaluation error",
};

export function failureReasonLabel(reason: PushFailureReason): string {
  return FAILURE_REASON_LABELS[reason];
}

const FAILURE_REASON_HINTS: Record<PushFailureReason, string> = {
  segment_busy: "Retry later.",
  segment_invalid: "Fix the segment.",
  query_too_heavy: "Narrow the segment.",
  evaluation_error: "Contact support.",
};

export function failureReasonHint(reason: PushFailureReason): string {
  return FAILURE_REASON_HINTS[reason];
}

export const DELIVERY_STATUSES: readonly PushDeliveryStatus[] = [
  "pending",
  "claimed",
  "queued",
  "delivered",
  "failed",
  "no_channel",
  "not_found",
  "cancelled",
  "held",
  "waiting",
];

const DELIVERY_STATUS_LABELS: Record<PushDeliveryStatus, string> = {
  pending: "Pending",
  claimed: "Claimed",
  queued: "Queued",
  delivered: "Delivered",
  failed: "Failed",
  no_channel: "No channel",
  not_found: "Not found",
  cancelled: "Cancelled",
  held: "Control group",
  waiting: "Waiting for the winner",
};

export function deliveryStatusLabel(status: PushDeliveryStatus): string {
  return DELIVERY_STATUS_LABELS[status];
}

const DELIVERY_STATUS_TONES: Record<PushDeliveryStatus, PushStatusTone> = {
  pending: "grey",
  claimed: "grey",
  queued: "blue",
  delivered: "green",
  failed: "red",
  no_channel: "red",
  not_found: "red",
  cancelled: "grey",
  held: "grey",
  waiting: "blue",
};

export function deliveryStatusTone(status: PushDeliveryStatus): PushStatusTone {
  return DELIVERY_STATUS_TONES[status];
}

// APNs reasons are a bounded CamelCase set (PushDelivery::APNS_REASON); FCM failures key by HTTP status.
const APNS_REASON_LABELS: Record<string, string> = {
  Unregistered: "Device uninstalled or token expired",
  BadDeviceToken: "Malformed or wrong-environment device token",
  PayloadTooLarge: "Notification payload too large",
  MissingDeviceToken: "Missing device token",
  ExpiredProviderToken: "Expired provider authentication token",
  InvalidProviderToken: "Invalid provider authentication token",
  MissingProviderToken: "Missing provider authentication token",
  BadTopic: "Wrong app bundle topic",
  DeviceTokenNotForTopic: "Device token does not match the app topic",
  TopicDisallowed: "Topic not allowed for this token",
  BadCertificate: "Invalid push certificate",
  BadCertificateEnvironment: "Certificate does not match the environment",
  Forbidden: "Not authorized to send to this device",
  IdleTimeout: "Connection idle timeout",
  Shutdown: "APNs server shutting down",
  InternalServerError: "APNs internal error",
  ServiceUnavailable: "APNs temporarily unavailable",
  TooManyRequests: "Too many requests to APNs for this token",
  TooManyProviderTokenUpdates: "Too many provider token updates",
  ExpiredToken: "Push token expired",
  InvalidToken: "Invalid push token",
};

const FCM_STATUS_LABELS: Record<string, string> = {
  "400": "Invalid request",
  "401": "Unauthenticated sender",
  "403": "Sender not allowed for this token",
  "404": "Device not registered",
  "429": "Too many requests",
  "500": "FCM internal error",
  "503": "FCM temporarily unavailable",
};

const DELIVERY_ERROR_LABELS: Record<string, string> = {
  no_app: "Push not configured for this platform",
  no_token: "Device has no push token",
};

const DELIVERY_ERROR_HINTS: Record<string, string> = {
  no_app: "Add the push credentials in iOS setup or Android setup.",
};

export function errorCountHint(key: string): string | null {
  return DELIVERY_ERROR_HINTS[key] ?? null;
}

const humanizeApnsReason = (reason: string) =>
  reason.replace(/([a-z0-9])([A-Z])/g, "$1 $2");

export function errorCountLabel(key: string): string {
  if (key in DELIVERY_ERROR_LABELS) return DELIVERY_ERROR_LABELS[key]!;
  if (/^\d+$/.test(key))
    return `FCM ${key}: ${FCM_STATUS_LABELS[key] ?? "Delivery failed"}`;
  return APNS_REASON_LABELS[key] ?? humanizeApnsReason(key);
}

const PUSH_ERROR_MESSAGES: Record<PushErrorCode, string> = {
  rate_limited: "Too many requests. Try again in a moment.",
  enterprise_required: "Push campaigns need an enterprise plan.",
  segment_busy: "Segments are busy right now. Retry in a moment.",
  invalid_segment: "This segment is no longer valid.",
  query_too_heavy:
    "This segment is too heavy to estimate. Narrow it and try again.",
  clickhouse_unavailable:
    "Segments are unavailable right now. Retry in a moment.",
};

export function pushErrorMessage(
  code: string | undefined,
  fallback: string
): string {
  return code && code in PUSH_ERROR_MESSAGES
    ? PUSH_ERROR_MESSAGES[code as PushErrorCode]
    : fallback;
}

export function pushErrorText(error: unknown, fallback: string): string {
  return error instanceof ApiError
    ? pushErrorMessage(error.code, error.message || fallback)
    : fallback;
}

// A 404 alone can be a missing campaign; only this message means the feature is off.
export function isPushNotEnabled(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 404) return false;
  const body =
    error.data && typeof error.data === "object" && "error" in error.data
      ? String((error.data as { error?: unknown }).error ?? "")
      : "";
  return /not enabled/i.test(body || error.message);
}

export interface ScheduleInput {
  scheduledAt: string | Date | null | undefined;
  localTime?: boolean;
  timezone?: string;
}

export function zoneOffsetMs(zone: string, instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

// Mirrors PushCampaign#local_time_lead: the easternmost zone must still get it on time.
export function localTimeLeadMs(
  timezone: string | undefined,
  at: Date
): number {
  try {
    return (
      EASTERNMOST_OFFSET_MS - zoneOffsetMs(timezone || "UTC", at.getTime())
    );
  } catch {
    // Unknown zone: the backend falls back to UTC.
    return EASTERNMOST_OFFSET_MS;
  }
}

// Mirrors PushCampaign#schedule_shape / PushCampaigns::Schedule.parse.
export function validateSchedule(
  { scheduledAt, localTime, timezone }: ScheduleInput,
  now: Date = new Date()
): string | null {
  if (!scheduledAt)
    return localTime ? "Local-time delivery needs a scheduled time." : null;

  const at = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  if (Number.isNaN(at.getTime())) return "Choose a valid date and time.";

  const delta = at.getTime() - now.getTime();
  if (delta <= 0) return "Schedule must be in the future.";
  if (delta > MAX_SCHEDULE_MS) return "Schedule must be within 30 days.";
  if (localTime) {
    const lead = localTimeLeadMs(timezone, at);
    const hours = Math.ceil(lead / 3_600_000);
    if (delta < lead)
      return `Local-time delivery needs at least ${hours} ${hours === 1 ? "hour's" : "hours'"} notice in this timezone.`;
  }
  return null;
}

export interface ApnsPayloadInput {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  link?: string | null;
  image?: string | null;
  sound?: string | null;
}

const PAYLOAD_OWNED_KEYS = ["grovs_campaign_id", "grovs_link", "grovs_image"];

// Mirrors PushCampaigns::Payload#apns; hashid is unknown pre-create, so a placeholder stands in.
export function apnsPayloadBytes({
  title,
  body,
  data,
  link,
  image,
  sound,
}: ApnsPayloadInput): number {
  const aps: Record<string, unknown> = { alert: { title, body } };
  if (sound) aps.sound = sound;
  if (image) aps["mutable-content"] = 1;

  const payload: Record<string, unknown> = { aps };
  for (const [key, value] of Object.entries(data ?? {})) {
    if (!PAYLOAD_OWNED_KEYS.includes(key)) payload[key] = value;
  }
  payload.grovs_campaign_id = "xxxxxx";
  if (link) payload.grovs_link = link;
  if (image) payload.grovs_image = image;

  return byteLength(JSON.stringify(payload));
}

export type SoundMode = "default" | "silent" | "custom";

export function soundValue(mode: SoundMode, sound: string): string | null {
  if (mode === "default") return "default";
  if (mode === "custom") return sound.trim() || null;
  return null;
}

export function soundMode(sound: string | null): SoundMode {
  if (!sound) return "silent";
  return sound === "default" ? "default" : "custom";
}

export function soundLabel(sound: string | null): string {
  if (!sound) return "Silent";
  return sound === "default" ? "Default" : sound;
}

export function viewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function wallClock(
  instant: Date,
  zone: string
): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

function zoneAbbreviation(instant: Date, zone: string): string {
  return (
    new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" })
      .formatToParts(instant)
      .find((p) => p.type === "timeZoneName")?.value ?? zone
  );
}

function knownZone(zone: string | null | undefined): string | null {
  if (!zone) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return null;
  }
}

// Formats both date and time in one zone: the campaign's, or the viewer's when it has none.
export function formatScheduledAt(
  campaign: Pick<PushCampaign, "scheduled_at" | "local_time" | "timezone">,
  style: "long" | "short" = "long",
  fallbackZone: string = viewerTimeZone()
): string | null {
  if (!campaign.scheduled_at) return null;
  const at = new Date(campaign.scheduled_at);
  if (Number.isNaN(at.getTime())) return null;
  const zone = knownZone(campaign.timezone) ?? knownZone(fallbackZone) ?? "UTC";
  const { date, time } = wallClock(at, zone);
  const day = format(
    parseISO(date),
    style === "long" ? "EEE, d MMM yyyy" : "MMM d, yyyy"
  );
  const when = style === "long" ? `${day} at ${time}` : `${day} ${time}`;
  return campaign.local_time
    ? `${when} in each user's local time`
    : `${when} ${zoneAbbreviation(at, zone)}`;
}

// Sends data[<key>] pairs, not JSON: the controller reads params[:data].to_unsafe_h.
export function buildPushFormData(
  input: PushCampaignInput,
  imageFile?: File | null
): FormData {
  const form = new FormData();
  const append = (key: string, value: string | number | null | undefined) => {
    if (value === undefined) return;
    form.append(key, value === null ? "" : String(value));
  };

  append("name", input.name);
  append("title", input.title);
  append("body", input.body);
  append("image_url", input.image_url);
  append("sound", input.sound);
  append("link_id", input.link_id);
  append("control_group", input.control_group);
  append("test_share", input.test_share);
  append("winner_after_minutes", input.winner_after_minutes);
  append("winner_by", input.winner_by);
  // Objects go as JSON, which the API parses; null clears.
  if (input.conversion !== undefined)
    form.append(
      "conversion",
      input.conversion === null ? "" : JSON.stringify(input.conversion)
    );
  if (input.variants !== undefined)
    form.append(
      "variants",
      input.variants === null ? "" : JSON.stringify(input.variants)
    );

  if (input.data !== undefined) {
    for (const [key, value] of Object.entries(input.data))
      form.append(
        `data[${key}]`,
        typeof value === "string" ? value : JSON.stringify(value)
      );
  }

  if (input.audience) {
    const audience: PushAudienceInput = input.audience;
    form.append("audience[type]", audience.type);
    if (audience.segment_id !== undefined)
      form.append("audience[segment_id]", audience.segment_id ?? "");
    for (const recipient of audience.recipients ?? [])
      form.append("audience[recipients][]", recipient);
  }

  if (imageFile) form.append("image", imageFile);

  return form;
}

// True when the source's image came from an upload, not a URL: duplicate must not copy the file.
export function hadUploadedImage(campaign: PushCampaign): boolean {
  return !campaign.image_url && !!campaign.image;
}

// Content, link and data copy as-is; an uploaded image never does (image_url does, since it's a URL).
export function duplicateInput(campaign: PushCampaign): PushCampaignInput {
  const audience: PushAudienceInput =
    campaign.audience.type === "segment"
      ? {
          type: "segment",
          ...(campaign.audience.segment_id
            ? { segment_id: campaign.audience.segment_id }
            : {}),
        }
      : {
          type: campaign.audience.type,
          recipients: campaign.audience.recipients ?? [],
        };

  return {
    name: campaign.name,
    title: campaign.title,
    body: campaign.body,
    ...(campaign.image_url ? { image_url: campaign.image_url } : {}),
    sound: campaign.sound,
    data: campaign.data,
    link_id: campaign.link_id,
    audience,
    // The experiment as set up, never its outcome.
    control_group: campaign.control_group ?? null,
    conversion: campaign.conversion ?? null,
    variants: campaign.variants ?? null,
    test_share: campaign.test_share ?? null,
    winner_after_minutes: campaign.winner_after_minutes ?? null,
    winner_by: campaign.winner_by ?? null,
  };
}

// Estimates without a platform split (older backends, very broad segments) fall back to all matched devices.
export const reachCount = (estimate: PushEstimate) =>
  estimate.reachable ?? estimate.devices;

export const devicesWord = (n: number | null | undefined) =>
  n === 1 ? "device" : "devices";

export const PUSH_PLATFORMS: { key: PushPlatform; label: string }[] = [
  { key: "ios", label: "iOS" },
  { key: "android", label: "Android" },
];

export interface PushChannels {
  ios: boolean;
  android: boolean;
}

// Credentials are per instance, so one check covers the test and production projects.
export function pushChannels(configs: PlatformAppConfig[]): PushChannels {
  const find = (platform: string) =>
    (Array.isArray(configs) ? configs : []).find((c) => c.platform === platform)
      ?.configuration;
  const ios = find("ios");
  const android = find("android");
  return {
    ios:
      !!ios?.push_configuration?.configured &&
      !!ios.app_prefix &&
      !!ios.bundle_id,
    android: !!android?.push_configuration?.firebase_project_id,
  };
}
