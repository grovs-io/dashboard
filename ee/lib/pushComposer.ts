import { addDays, format, formatDistanceStrict, parseISO } from "date-fns";
import {
  soundMode,
  soundValue,
  validateSchedule,
  viewerTimeZone,
  wallClock,
  zoneOffsetMs,
} from "@ee/lib/push";
import { dataRowsToObject, type PushContentFormValues } from "@/schemas/push";
import type { AudienceValue } from "@ee/types/audience";
import type {
  PushAudienceInput,
  PushCampaign,
  PushCampaignInput,
  PushScheduleInput,
  PushVariant,
  WinnerAfter,
  WinnerBy,
} from "@ee/types/push";
import {
  VARIANT_IDS,
  goalInput,
  goalReady,
  type Conversion,
  type VariantId,
} from "@ee/types/experiment";
import { goalProblem } from "@ee/lib/inAppComposer";

export const PUSH_SECTIONS = [
  "message",
  "audience",
  "experiment",
  "delivery",
] as const;
export type PushSection = (typeof PUSH_SECTIONS)[number];

export const SECTION_LABELS: Record<PushSection, string> = {
  message: "Message",
  audience: "Audience",
  experiment: "Experiment",
  delivery: "Delivery",
};

export interface ExperimentValue {
  controlGroup: number | null;
  conversion: Conversion | null;
  variants: PushVariant[];
  // With variants only; null sends to everyone at once.
  testShare: number | null;
  // With a test share only; null means the owner picks the winner from the report.
  winnerAfter: WinnerAfter | null;
  winnerBy: WinnerBy;
}

export const TEST_SHARES = [10, 20, 30, 50] as const;

export const emptyExperiment = (): ExperimentValue => ({
  controlGroup: null,
  conversion: null,
  variants: [],
  testShare: null,
  winnerAfter: null,
  winnerBy: "opens",
});

export function experimentFromCampaign(c: PushCampaign): ExperimentValue {
  return {
    controlGroup: c.control_group ?? null,
    conversion: c.conversion ?? null,
    variants: c.variants ?? [],
    testShare: c.test_share ?? null,
    winnerAfter: c.winner_after_minutes ?? null,
    winnerBy: c.winner_by ?? "opens",
  };
}

// "2 h", "30 min", "1 day".
export const winnerAfterLabel = (minutes: WinnerAfter) =>
  minutes < 60
    ? `${minutes} min`
    : minutes < 1440
      ? `${minutes / 60} h`
      : "1 day";

// A new variant starts as a copy of A; ids stay b then c in order.
export function addPushVariant(
  e: ExperimentValue,
  a: { title: string; body: string }
): ExperimentValue {
  if (e.variants.length >= VARIANT_IDS.length) return e;
  return {
    ...e,
    variants: [
      ...e.variants,
      { id: VARIANT_IDS[e.variants.length]!, title: a.title, body: a.body },
    ],
  };
}

export function removePushVariant(
  e: ExperimentValue,
  variant: VariantId
): ExperimentValue {
  const variants = e.variants
    .filter((v) => v.id !== variant)
    .map((v, i) => ({ ...v, id: VARIANT_IDS[i]! }));
  return {
    ...e,
    variants,
    testShare: variants.length ? e.testShare : null,
    winnerAfter: variants.length ? e.winnerAfter : null,
  };
}

export const LOCAL_TIME_SHARE =
  "A test share and local-time delivery can't be used together. Turn one of them off.";

export function experimentProblems(
  e: ExperimentValue,
  options: { localTime?: boolean } = {}
): string[] {
  const out: string[] = [];
  if (options.localTime && e.variants.length > 0 && e.testShare !== null)
    out.push(LOCAL_TIME_SHARE);
  if (e.conversion && !goalReady(e.conversion))
    out.push(goalProblem(e.conversion));
  if (
    e.variants.length > 0 &&
    e.testShare !== null &&
    e.winnerAfter !== null &&
    e.winnerBy === "conversions" &&
    !e.conversion
  )
    out.push("To pick the winner by conversions, choose a goal in this step.");
  for (const v of e.variants) {
    const name = `Variant ${v.id.toUpperCase()}`;
    if (!v.title.trim()) out.push(`${name}: add a title.`);
    else if (v.title.trim().length > 255)
      out.push(`${name}: the title is too long, at most 255 characters.`);
    if (!v.body.trim()) out.push(`${name}: add the message text.`);
    else if (v.body.trim().length > 1000)
      out.push(`${name}: the message is too long, at most 1000 characters.`);
  }
  return out;
}

// "10% control group · 2 variants · 20% test share", or null without an experiment.
export function experimentSummary(e: ExperimentValue): string | null {
  const parts = [
    e.controlGroup !== null && `${e.controlGroup}% control group`,
    e.variants.length > 0 &&
      `${e.variants.length} variant${e.variants.length === 1 ? "" : "s"}`,
    e.variants.length > 0 &&
      e.testShare !== null &&
      `${e.testShare}% test share`,
    e.variants.length > 0 &&
      e.testShare !== null &&
      e.winnerAfter !== null &&
      `winner after ${winnerAfterLabel(e.winnerAfter)} by ${e.winnerBy}`,
  ].filter((x): x is string => !!x);
  return parts.length ? parts.join(" · ") : null;
}

export function experimentInput(e: ExperimentValue) {
  const variants = e.variants.length ? e.variants : null;
  return {
    control_group: e.controlGroup,
    conversion: e.conversion ? goalInput(e.conversion) : null,
    variants:
      variants?.map((v) => ({
        id: v.id,
        title: v.title.trim(),
        body: v.body.trim(),
      })) ?? null,
    test_share: variants ? e.testShare : null,
    winner_after_minutes:
      variants && e.testShare !== null ? e.winnerAfter : null,
    winner_by:
      variants && e.testShare !== null && e.winnerAfter !== null
        ? e.winnerBy
        : null,
  };
}

export interface ScheduleValue {
  mode: "now" | "schedule";
  date: string;
  time: string;
  localTime: boolean;
  timezone: string;
}

export function timezoneOptions(): string[] {
  const viewer = viewerTimeZone();
  const supported = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  if (typeof supported !== "function") return [viewer];
  try {
    const zones = supported("timeZone");
    if (!zones.length) return [viewer];
    const all = new Set(zones);
    all.add(viewer);
    all.add("UTC");
    return [...all].sort();
  } catch {
    return [viewer];
  }
}

export const emptyContent = (): PushContentFormValues => ({
  title: "",
  body: "",
  imageUrl: "",
  soundMode: "default",
  sound: "",
  linkId: null,
  data: [],
});

export const emptyAudience = (): AudienceValue => ({
  type: "segment",
  recipients: [],
});

export const defaultSchedule = (): ScheduleValue => ({
  mode: "now",
  date: "",
  time: "09:00",
  localTime: false,
  timezone: viewerTimeZone(),
});

export function contentFromCampaign(c: PushCampaign): PushContentFormValues {
  return {
    title: c.title,
    body: c.body,
    imageUrl: c.image_url ?? "",
    soundMode: soundMode(c.sound),
    sound: soundMode(c.sound) === "custom" ? c.sound! : "",
    linkId: c.link_id,
    data: Object.entries(c.data ?? {}).map(([key, value]) =>
      typeof value === "string"
        ? { key, value }
        : { key, value: JSON.stringify(value), original: value }
    ),
  };
}

export function audienceFromCampaign(c: PushCampaign): AudienceValue {
  return {
    type: c.audience.type,
    segmentId: c.audience.segment_id ?? undefined,
    recipients: c.audience.recipients ?? [],
  };
}

export function audienceValid(a: AudienceValue): boolean {
  return a.type === "segment" ? !!a.segmentId : a.recipients.length > 0;
}

export function audienceInput(a: AudienceValue): PushAudienceInput {
  return a.type === "segment"
    ? { type: "segment", segment_id: a.segmentId }
    : { type: a.type, recipients: a.recipients };
}

// The name follows the title unless it already differs (e.g. set through the API).
export function nameFollowsTitle(campaign: PushCampaign | null | undefined) {
  return !campaign || campaign.name === campaign.title;
}

export function campaignInput(
  content: PushContentFormValues,
  audience: AudienceValue,
  campaign?: PushCampaign | null,
  experiment: ExperimentValue = emptyExperiment()
): PushCampaignInput {
  const title = content.title.trim();
  return {
    ...(nameFollowsTitle(campaign) ? { name: title } : {}),
    title,
    body: content.body.trim(),
    image_url: content.imageUrl.trim() || null,
    sound: soundValue(content.soundMode, content.sound),
    link_id: content.linkId,
    data: dataRowsToObject(content.data),
    audience: audienceInput(audience),
    ...experimentInput(experiment),
  };
}

// Only the changed top-level fields go in a PATCH, so an untouched field is never rewritten.
export function inputDiff(
  before: PushCampaignInput | null,
  after: PushCampaignInput
): PushCampaignInput {
  if (!before) return after;
  const diff: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(after)) {
    const prev = (before as Record<string, unknown>)[key];
    if (JSON.stringify(prev) !== JSON.stringify(value)) diff[key] = value;
  }
  return diff as PushCampaignInput;
}

export function zonedWallTimeToUtc(
  date: string,
  time: string,
  zone: string
): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const [, y, mo, day] = d.map(Number);
  const [, h, mi] = t.map(Number);
  const wall = Date.UTC(y!, mo! - 1, day!, h!, mi!);
  try {
    let utc = wall - zoneOffsetMs(zone, wall);
    utc = wall - zoneOffsetMs(zone, utc);
    return new Date(utc);
  } catch {
    return null;
  }
}

// Local time reads the wall clock in the chosen zone; otherwise in the viewer's own zone.
export function scheduleZone(s: ScheduleValue): string {
  return s.localTime ? s.timezone : viewerTimeZone();
}

export function scheduledInstant(s: ScheduleValue): Date | null {
  if (s.mode === "now") return null;
  return zonedWallTimeToUtc(s.date, s.time, scheduleZone(s));
}

export function scheduleError(
  s: ScheduleValue,
  now: Date = new Date()
): string | null {
  if (s.mode === "now") return null;
  if (!s.date || !s.time) return "Pick the date and time to send it.";
  const at = scheduledInstant(s);
  if (!at) return "That date and time isn't valid. Pick it again.";
  return validateSchedule(
    { scheduledAt: at, localTime: s.localTime, timezone: scheduleZone(s) },
    now
  );
}

export function scheduleLabel(s: ScheduleValue): string {
  if (s.mode === "now" || !s.date) return "Now";
  return `${format(parseISO(s.date), "MMM d, yyyy")}, ${s.time}`;
}

export const TIME_STEPS: string[] = Array.from(
  { length: 96 },
  (_, i) =>
    `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`
);

// Accepts "9:07", "09:07" or "0907"; returns a zero-padded 24h "HH:mm" or null.
export function parseTime(text: string): string | null {
  const m = /^(\d{1,2}):?(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export interface SchedulePreset {
  label: string;
  date: string;
  time: string;
  error: string | null;
}

export function schedulePresets(
  s: ScheduleValue,
  now: Date = new Date()
): SchedulePreset[] {
  const zone = scheduleZone(s);
  const inAnHour = wallClock(
    new Date(Math.ceil((now.getTime() + 3_600_000) / 60_000) * 60_000),
    zone
  );
  const today = parseISO(wallClock(now, zone).date);
  const monday = addDays(today, (8 - today.getDay()) % 7 || 7);
  const presets = [
    { label: "In 1 hour", ...inAnHour },
    {
      label: "Tomorrow 09:00",
      date: format(addDays(today, 1), "yyyy-MM-dd"),
      time: "09:00",
    },
    {
      label: "Next Monday 09:00",
      date: format(monday, "yyyy-MM-dd"),
      time: "09:00",
    },
  ];
  return presets.map((p) => ({
    ...p,
    error: scheduleError(
      { ...s, mode: "schedule", date: p.date, time: p.time },
      now
    ),
  }));
}

export function scheduleSummary(
  s: ScheduleValue,
  now: Date = new Date()
): string | null {
  const at = scheduledInstant(s);
  if (!at || s.mode === "now") return null;
  const when = `${format(parseISO(s.date), "EEE, d MMM")} at ${s.time}`;
  if (s.localTime) return `Sends ${when} in each user's timezone`;
  const relative = at > now ? ` · in ${formatDistanceStrict(at, now)}` : "";
  return `Sends ${when} ${scheduleZone(s)}${relative}`;
}

export function scheduleInput(s: ScheduleValue): PushScheduleInput {
  const at = scheduledInstant(s);
  if (!at) return {};
  return {
    scheduled_at: at.toISOString(),
    local_time: s.localTime,
    timezone: scheduleZone(s),
  };
}

const SECTION_RULES: [RegExp, PushSection][] = [
  [/\b(scheduled[ _]at|local[ _]time|timezone)\b/i, "delivery"],
  [
    /\b(variants?|control[ _]group|conversion|test[ _]share|winner)\b/i,
    "experiment",
  ],
  [/\b(recipients|segment|audience)\b/i, "audience"],
  [
    /\b(name|title|body|image|image[ _]url|sound|data|link|payload)\b/i,
    "message",
  ],
];

// Rails joins full_messages with ", "; the field named first decides the section.
export function pushErrorSection(message: string): PushSection | null {
  let best: { index: number; section: PushSection } | null = null;
  for (const [pattern, section] of SECTION_RULES) {
    const match = pattern.exec(message);
    if (match && (!best || match.index < best.index))
      best = { index: match.index, section };
  }
  return best?.section ?? null;
}
