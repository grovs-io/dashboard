import { isColor } from "@/lib/color";
import { TEMPLATES, type TemplateInfo } from "@ee/lib/inApp";
import { htmlProblems, htmlWarnings } from "@ee/lib/inAppHtml";
import { SYSTEM_EVENT_INFO, goalInput, goalReady } from "@ee/types/experiment";
import {
  VARIANT_IDS,
  goalKind,
  type InAppAction,
  type InAppButton,
  type InAppCampaign,
  type InAppCampaignInput,
  type InAppCaps,
  type InAppCondition,
  type InAppContent,
  type InAppConversion,
  type InAppLayout,
  type InAppConversionWindow,
  type InAppQuestion,
  type InAppQuestionType,
  type InAppOrientation,
  type InAppTemplate,
  type InAppTrigger,
  type InAppVariantId,
} from "@ee/types/inApp";

export const IN_APP_SECTIONS = [
  "message",
  "trigger",
  "audience",
  "experiment",
  "limits",
  "review",
] as const;
export type InAppSection = (typeof IN_APP_SECTIONS)[number];

export const SECTION_LABELS: Record<InAppSection, string> = {
  message: "Message",
  trigger: "Trigger",
  audience: "Audience",
  experiment: "Experiment",
  limits: "Limits and schedule",
  review: "Check and launch",
};

export const MAX_TRIGGERS = 5;
export const MAX_FILTERS = 5;
export const MAX_CONDITIONS = 10;
export const MAX_BUTTONS = 2;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 5;

export interface DraftQuestion {
  type: InAppQuestionType;
  options: { id: string; text: string }[];
  // Stars: the highest answer that counts as a low one.
  split: number;
  // The question asked after a low answer, or after any choice; null asks nothing.
  low: string | null;
  // Stars: the question asked after a high answer.
  high: string | null;
  // Stars: the lowest answer that is asked for a store review.
  reviewFrom: number | null;
  thanks: string;
}

// What differs between variants. Pictures are A's for every variant.
export interface DraftContent {
  title: string;
  message: string;
  colors: { background?: string; title?: string; message?: string };
  closeButton: boolean;
  // False when only a button or a tap on the message may close it.
  dismissible: boolean;
  backdrop: "dim" | "none";
  buttons: InAppButton[];
  tapAction: InAppAction | null;
  // Buttons and the tap action stay in the draft, but are not sent with a question.
  question: DraftQuestion | null;
  // Template html only; each variant has its own.
  html: string;
  layout: InAppLayout;
}

export const CONTENT_KEYS = [
  "title",
  "message",
  "colors",
  "closeButton",
  "dismissible",
  "backdrop",
  "buttons",
  "tapAction",
  "question",
  "html",
  "layout",
] as const satisfies readonly (keyof DraftContent)[];

export interface DraftVariant {
  id: InAppVariantId;
  content: DraftContent;
}

export interface InAppDraft extends DraftContent {
  name: string;
  template: InAppTemplate;
  image: { portrait: string | null; landscape: string | null };
  // One for the whole campaign; every variant carries it.
  orientation: InAppOrientation;
  triggers: InAppTrigger[];
  conditions: InAppCondition[];
  audience: { type: "all" } | { type: "segment"; segmentId?: string };
  controlGroup: number | null;
  conversion: InAppConversion | null;
  variants: DraftVariant[];
  caps: Required<InAppCaps>;
  priority: number;
  delaySeconds: number;
  // Local wall time, as a datetime-local input holds it.
  startAt: string;
  endAt: string;
  days: number[];
  from: string;
  to: string;
}

export const emptyContent = (): DraftContent => ({
  title: "",
  message: "",
  colors: {},
  closeButton: true,
  dismissible: true,
  backdrop: "dim",
  buttons: [],
  tapAction: null,
  question: null,
  html: "",
  layout: "modal",
});

export const emptyDraft = (): InAppDraft => ({
  ...emptyContent(),
  name: "",
  template: "interstitial",
  image: { portrait: null, landscape: null },
  orientation: "any",
  triggers: [{ type: "app_open" }],
  controlGroup: null,
  conversion: null,
  variants: [],
  conditions: [],
  audience: { type: "all" },
  caps: {
    session: 1,
    day: null,
    week: null,
    lifetime: null,
    ignore_global: false,
  },
  priority: 1,
  delaySeconds: 0,
  startAt: "",
  endAt: "",
  days: [],
  from: "",
  to: "",
});

const pad = (n: number) => String(n).padStart(2, "0");

export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const LOW_QUESTION: Record<InAppQuestionType, string> = {
  stars: "What could be better?",
  choice: "Anything to add?",
};
export const HIGH_QUESTION = "What do you like most?";

export const blankQuestion = (type: InAppQuestionType): DraftQuestion => ({
  type,
  options: [
    { id: "option_1", text: "" },
    { id: "option_2", text: "" },
  ],
  split: 3,
  low: null,
  high: null,
  reviewFrom: null,
  thanks: "",
});

// "4 or 5 stars": the answers from one number of stars to another, in words.
export function starsLabel(from: number, to: number): string {
  if (from === to) return `${from} star${from === 1 ? "" : "s"}`;
  return `${from} ${to - from === 1 ? "or" : "to"} ${to} stars`;
}

export const lowStars = (q: DraftQuestion) => starsLabel(1, q.split);
export const highStars = (q: DraftQuestion) => starsLabel(q.split + 1, 5);

const BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz";

// Ids are what the report counts answers by: a new choice never gets the id of
// a removed one, or its past answers would show under the new text.
export function newOptionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `o_${Array.from(bytes, (b) => BASE36[b % 36]).join("")}`;
}

function draftQuestion(q: InAppQuestion): DraftQuestion {
  const low = q.comment?.low ?? null;
  // Without a split everyone is asked the same, which is the same question on both sides of one.
  const same = q.type === "stars" && q.comment?.split === null;
  return {
    type: q.type,
    options: q.type === "choice" ? q.options : blankQuestion(q.type).options,
    split: q.comment?.split ?? 3,
    low,
    high: same ? low : (q.comment?.high ?? null),
    reviewFrom: q.review_from,
    thanks: q.thanks ?? "",
  };
}

function cleanQuestion(q: DraftQuestion): InAppQuestion {
  const stars = q.type === "stars";
  const low = q.low?.trim() || null;
  const high = (stars && q.high?.trim()) || null;
  return {
    id: "q1",
    type: q.type,
    options: stars
      ? []
      : q.options.map((o) => ({ id: o.id, text: o.text.trim() })),
    comment: low || high ? { split: stars ? q.split : null, low, high } : null,
    thanks: q.thanks.trim() || null,
    review_from: stars ? q.reviewFrom : null,
  };
}

// Why this template cannot show a question, if it cannot.
export const questionTemplateReason = (template: InAppTemplate) =>
  template === "alert" ||
  TEMPLATES[template].imageOnly ||
  TEMPLATES[template].html
    ? "Cannot hold a question"
    : null;

export const questionTemplateProblem = (
  draft: Pick<InAppDraft, "question" | "template">
) =>
  draft.question && questionTemplateReason(draft.template)
    ? `${TEMPLATES[draft.template].label} cannot hold a question. Choose another template.`
    : null;

const quoted = (text: string) => `“${text.trim()}”`;

// The question in plain words, for the review step and the report.
export function questionSentences(q: DraftQuestion): string[] {
  const stars = q.type === "stars";
  const low = q.low?.trim();
  const high = stars && q.high?.trim();
  const out = [
    stars
      ? "Asks for 1 to 5 stars."
      : `Asks to pick one of: ${q.options.map((o) => o.text.trim() || "no text").join(", ")}.`,
  ];
  if (low)
    out.push(
      stars
        ? `People who give ${lowStars(q)} are asked ${quoted(low)}.`
        : `Then asks ${quoted(low)}.`
    );
  if (high)
    out.push(`People who give ${highStars(q)} are asked ${quoted(high)}.`);
  if (stars && q.reviewFrom !== null)
    out.push(
      `People who give ${starsLabel(q.reviewFrom, 5)} are asked for a store review.`
    );
  if (q.thanks.trim()) out.push(`Says ${quoted(q.thanks)}.`);
  return out;
}

export function draftContent(content: InAppContent): DraftContent {
  return {
    title: content.title ?? "",
    message: content.message ?? "",
    colors: content.colors ?? {},
    closeButton: content.close_button ?? true,
    dismissible: content.dismissible ?? true,
    backdrop: content.backdrop ?? "dim",
    buttons: content.buttons ?? [],
    tapAction: content.tap_action ?? null,
    question: content.question ? draftQuestion(content.question) : null,
    html: content.html ?? "",
    layout: content.layout ?? "modal",
  };
}

export const VARIANT_LABELS: Record<"a" | InAppVariantId, string> = {
  a: "A · Your message",
  b: "B",
  c: "C",
};

export type VariantKey = "a" | InAppVariantId;

// The content of one variant, A being the draft's own.
export function variantContent(
  draft: InAppDraft,
  variant: VariantKey
): DraftContent {
  const own: DraftContent =
    (variant === "a"
      ? null
      : draft.variants.find((v) => v.id === variant)?.content) ?? draft;
  return {
    title: own.title,
    message: own.message,
    colors: own.colors,
    closeButton: own.closeButton,
    dismissible: own.dismissible,
    backdrop: own.backdrop,
    buttons: own.buttons,
    tapAction: own.tapAction,
    question: own.question,
    html: own.html,
    layout: own.layout,
  };
}

// The draft as the editor and the preview see it with this variant selected.
export const withVariant = (draft: InAppDraft, variant: VariantKey) =>
  variant === "a" ? draft : { ...draft, ...variantContent(draft, variant) };

const isContentKey = (key: string): key is keyof DraftContent =>
  (CONTENT_KEYS as readonly string[]).includes(key);

// The server keeps every variant's question the same as A's in kind and choices;
// only the wording differs. A variant follows A, keeping the texts it typed for matching choices.
export function mirrorQuestion(
  a: DraftQuestion | null,
  own: DraftQuestion | null
): DraftQuestion | null {
  if (!a) return null;
  if (!own || own.type !== a.type) return { ...a };
  return {
    ...own,
    options: a.options.map(
      (o) => own.options.find((mine) => mine.id === o.id) ?? o
    ),
  };
}

// An edit to a variant goes to its content; anything else is the campaign's.
export function patchVariant(
  draft: InAppDraft,
  variant: VariantKey,
  patch: Partial<InAppDraft>
): InAppDraft {
  if (variant === "a") {
    const next = { ...draft, ...patch };
    return "question" in patch
      ? {
          ...next,
          variants: next.variants.map((v) => ({
            ...v,
            content: {
              ...v.content,
              question: mirrorQuestion(next.question, v.content.question),
            },
          })),
        }
      : next;
  }
  const content: Partial<DraftContent> = {};
  const rest: Partial<InAppDraft> = {};
  for (const [key, value] of Object.entries(patch))
    Object.assign(isContentKey(key) ? content : rest, { [key]: value });
  return {
    ...draft,
    ...rest,
    variants: draft.variants.map((v) =>
      v.id === variant ? { ...v, content: { ...v.content, ...content } } : v
    ),
  };
}

// A new variant starts as a copy of the one being edited; ids stay b then c in order.
export const addVariant = (
  draft: InAppDraft,
  from: VariantKey = "a"
): InAppDraft =>
  draft.variants.length >= VARIANT_IDS.length
    ? draft
    : {
        ...draft,
        variants: [
          ...draft.variants,
          {
            id: VARIANT_IDS[draft.variants.length]!,
            content: variantContent(draft, from),
          },
        ],
      };

// The next variant's id, for selecting it once added.
export const nextVariantId = (draft: InAppDraft): VariantKey =>
  VARIANT_IDS[draft.variants.length] ?? "a";

export const removeVariant = (
  draft: InAppDraft,
  variant: InAppVariantId
): InAppDraft => ({
  ...draft,
  variants: draft.variants
    .filter((v) => v.id !== variant)
    .map((v, i) => ({ ...v, id: VARIANT_IDS[i]! })),
});

export function draftFromCampaign(c: InAppCampaign): InAppDraft {
  const empty = emptyDraft();
  return {
    ...draftContent(c.content),
    name: c.name,
    template: c.template,
    image: { ...empty.image, ...(c.content.image ?? {}) },
    orientation: c.content.orientation ?? "any",
    triggers: c.triggers,
    conditions: c.conditions,
    audience:
      c.audience.type === "segment"
        ? { type: "segment", segmentId: c.audience.segment_id ?? undefined }
        : { type: "all" },
    controlGroup: c.control_group ?? null,
    conversion: c.conversion ?? null,
    variants: (c.variants ?? []).map((v) => ({
      id: v.id,
      content: draftContent(v.content),
    })),
    caps: {
      session: c.caps.session ?? null,
      day: c.caps.day ?? null,
      week: c.caps.week ?? null,
      lifetime: c.caps.lifetime ?? null,
      ignore_global: c.caps.ignore_global ?? false,
    },
    priority: c.priority,
    delaySeconds: c.delay_seconds,
    startAt: toLocalInput(c.start_at),
    endAt: toLocalInput(c.end_at),
    days: c.schedule.days ?? [],
    from: c.schedule.from ?? "",
    to: c.schedule.to ?? "",
  };
}

export { isColor };

// Whether text on this colour should be light; the same weighting the SDKs use.
export function isDark(hex: string): boolean {
  const part = (at: number) => parseInt(hex.slice(at, at + 2), 16);
  return (part(1) * 299 + part(3) * 587 + part(5) * 114) / 1000 < 128;
}

type Colors = Record<string, string | undefined>;

export const sameColors = (a: Colors, b: Colors) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every(
    (key) => (a[key] ?? "").toUpperCase() === (b[key] ?? "").toUpperCase()
  );
};

export interface ColorTheme {
  name: string;
  swatch: string;
  colors: InAppDraft["colors"];
  // The first button is the main one.
  button: (index: number) => { background?: string; text?: string };
}

export const COLOR_THEMES: ColorTheme[] = [
  { name: "Light", swatch: "#FFFFFF", colors: {}, button: () => ({}) },
  {
    name: "Dark",
    swatch: "#111827",
    colors: { background: "#111827", title: "#FFFFFF", message: "#D1D5DB" },
    button: (index) =>
      index === 0
        ? { background: "#FFFFFF", text: "#111827" }
        : { background: "#374151", text: "#FFFFFF" },
  },
  {
    name: "Blue",
    swatch: "#2A86FF",
    colors: { background: "#2A86FF", title: "#FFFFFF", message: "#EAF3FF" },
    button: (index) =>
      index === 0
        ? { background: "#FFFFFF", text: "#1E6EDC" }
        : { background: "#1E6EDC", text: "#FFFFFF" },
  },
];

// Only colours a device can read are sent; anything else is dropped, not guessed.
const cleanColors = <T extends Colors>(colors: T) =>
  Object.fromEntries(
    Object.entries(colors).filter(([, v]) => v && isColor(v))
  ) as T;

function cleanAction(action: InAppAction): InAppAction {
  if (action.type === "open_url")
    return { type: action.type, url: (action.url ?? "").trim() };
  if (action.type === "key_value")
    return { type: action.type, payload: action.payload ?? {} };
  return { type: action.type };
}

function cleanTrigger(trigger: InAppTrigger): InAppTrigger {
  if (trigger.type === "app_open") return { type: "app_open" };
  if (trigger.type === "screen_view") {
    const name = trigger.name?.trim();
    return name ? { type: "screen_view", name } : { type: "screen_view" };
  }
  const filters = trigger.filters ?? [];
  return {
    type: "event",
    name: trigger.name.trim(),
    ...(filters.length ? { filters } : {}),
  };
}

// A date input gives a day; the definition wants the instant that day starts, in UTC.
function cleanCondition(condition: InAppCondition): InAppCondition {
  if (
    condition.type === "first_seen" &&
    condition.op !== "within_days" &&
    typeof condition.value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(condition.value)
  )
    return { ...condition, value: `${condition.value}T00:00:00Z` };
  if (condition.type === "event_count")
    return { ...condition, name: condition.name?.trim() };
  if (condition.type === "user_attribute")
    return { ...condition, key: condition.key?.trim() };
  return condition;
}

// The name is only a label in the list, so the title does when none was given.
export const draftName = (draft: InAppDraft): string =>
  (
    draft.name.trim() ||
    plainText(draft.title) ||
    plainText(draft.message).split("\n")[0] ||
    "Untitled message"
  ).slice(0, 255);

// A field reads as its fallback, or as nothing, so a name never shows braces.
export const plainText = (text: string): string =>
  text
    .replace(
      /\{\{\s*(?:user|event)\.[A-Za-z0-9_]+\s*(?:\|\s*default:\s*"([^"{}]*)"\s*)?\}\}/g,
      (_all, fallback?: string) => fallback ?? ""
    )
    .replace(/[ \t]{2,}/g, " ")
    .trim();

// What the API receives. An image-only template carries no text and no buttons;
// a question comes with no buttons and no tap action.
function contentInput(
  content: DraftContent,
  image: InAppDraft["image"],
  kind: TemplateInfo,
  orientation: InAppOrientation
): InAppContent {
  // Sent only when restricted; absent means any.
  const oriented = orientation === "any" ? {} : { orientation };
  if (kind.html)
    return {
      ...oriented,
      title: null,
      message: null,
      image: { portrait: null, landscape: null },
      colors: {},
      close_button: true,
      dismissible: content.dismissible,
      backdrop: content.layout === "modal" ? content.backdrop : "none",
      buttons: [],
      tap_action: null,
      question: null,
      html: content.html,
      layout: content.layout,
    };
  const text = !kind.imageOnly;
  return {
    ...oriented,
    title: text ? content.title.trim() || null : null,
    message: text ? content.message.trim() || null : null,
    image: kind.image ? image : { portrait: null, landscape: null },
    colors: cleanColors(content.colors),
    close_button: content.closeButton,
    dismissible: content.dismissible,
    backdrop: kind.banner ? "none" : content.backdrop,
    buttons:
      text && !content.question
        ? content.buttons.map((b) => ({
            id: b.id,
            text: b.text.trim(),
            action: cleanAction(b.action),
            ...(b.colors && Object.keys(cleanColors(b.colors)).length
              ? { colors: cleanColors(b.colors) }
              : {}),
          }))
        : [],
    tap_action:
      content.tapAction && !content.question
        ? cleanAction(content.tapAction)
        : null,
    question: content.question ? cleanQuestion(content.question) : null,
  };
}

export function draftInput(
  draft: InAppDraft,
  options: { withAudience: boolean }
): InAppCampaignInput {
  const kind = TEMPLATES[draft.template];
  const timed = draft.from !== "" && draft.to !== "";
  const input: InAppCampaignInput = {
    name: draftName(draft),
    template: draft.template,
    content: contentInput(draft, draft.image, kind, draft.orientation),
    control_group: draft.controlGroup,
    conversion: draft.conversion ? goalInput(draft.conversion) : null,
    // Uploads only reach the campaign's own pictures, so every variant carries A's.
    variants: draft.variants.length
      ? draft.variants.map((v) => ({
          id: v.id,
          content: contentInput(
            v.content,
            draft.image,
            kind,
            draft.orientation
          ),
        }))
      : null,
    triggers: draft.triggers.map(cleanTrigger),
    conditions: draft.conditions.map(cleanCondition),
    caps: draft.caps,
    schedule: {
      days: draft.days.length ? [...draft.days].sort((a, b) => a - b) : null,
      from: timed ? draft.from : null,
      to: timed ? draft.to : null,
    },
    priority: draft.priority,
    delay_seconds: draft.delaySeconds,
    start_at: fromLocalInput(draft.startAt),
    end_at: fromLocalInput(draft.endAt),
  };
  if (options.withAudience && draft.audience.type === "all")
    input.audience = { type: "all" };
  if (
    options.withAudience &&
    draft.audience.type === "segment" &&
    draft.audience.segmentId
  )
    input.audience = { type: "segment", segment_id: draft.audience.segmentId };
  return input;
}

const LINK = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const UNSAFE = /^(javascript|data|file|blob):/i;
const FIELD =
  /\{\{\s*(user|event)\.[A-Za-z0-9_]+\s*(\|\s*default:\s*"[^"{}]*"\s*)?\}\}/g;

export function linkProblem(url: string | undefined): string | null {
  const value = (url ?? "").trim();
  if (!value)
    return "Add the link it opens, such as https://example.com/offer.";
  if (!LINK.test(value))
    return "The link must start with https://, http:// or your app's scheme, such as myapp://.";
  if (UNSAFE.test(value))
    return "javascript:, data:, file: and blob: links can't be used. Use an https:// or app link.";
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#]*\{\{/.test(value))
    return "A personalised value can only go after the domain, after the first /.";
  return null;
}

export const bracesProblem = (text: string): string | null =>
  text.replace(FIELD, "").includes("{{")
    ? 'A personalised value is not written correctly. Use Insert a value, or write it as {{ user.first_name | default: "there" }}.'
    : null;

function actionProblem(action: InAppAction): string | null {
  return action.type === "open_url" ? linkProblem(action.url) : null;
}

function questionProblems(
  draft: Pick<InAppDraft, "question" | "template">,
  q: DraftQuestion
): string[] {
  const out: string[] = [];
  const template = questionTemplateProblem(draft);
  if (template) out.push(template);
  if (q.type === "choice") {
    if (q.options.length < MIN_OPTIONS || q.options.length > MAX_OPTIONS)
      out.push(`A choice list needs ${MIN_OPTIONS} to ${MAX_OPTIONS} choices.`);
    q.options.forEach((option, i) => {
      if (!option.text.trim())
        out.push(`Choice ${i + 1} is empty. Type its text.`);
    });
    if (new Set(q.options.map((o) => o.id)).size < q.options.length)
      out.push(
        "Two choices would be counted as one. Remove one of them and add it again."
      );
  }
  if (q.low !== null && !q.low.trim())
    out.push(
      q.type === "stars"
        ? `Write the question for ${lowStars(q)}.`
        : "Write the follow-up question."
    );
  if (q.type === "stars" && q.high !== null && !q.high.trim())
    out.push(`Write the question for ${highStars(q)}.`);
  return out;
}

export type SectionProblems = Record<InAppSection, string[]>;

// The system alert gets cramped with long text; the server checks the same limits.
export const ALERT_LIMITS = { title: 80, message: 300, button: 30 } as const;

// Code points of the trimmed text, as it is sent and the server counts it; an emoji is one.
export const charCount = (s: string) => [...s.trim()].length;

export const alertTitleProblem = (title: string) =>
  charCount(title) > ALERT_LIMITS.title
    ? `The alert title is too long: it can have at most ${ALERT_LIMITS.title} characters.`
    : null;
export const alertMessageProblem = (message: string) =>
  charCount(message) > ALERT_LIMITS.message
    ? `The alert message is too long: it can have at most ${ALERT_LIMITS.message} characters.`
    : null;
export const alertButtonProblem = (text: string, i: number) =>
  charCount(text) > ALERT_LIMITS.button
    ? `Button ${i + 1}: the label is too long, an alert button can have at most ${ALERT_LIMITS.button} characters.`
    : null;

export function alertLimitProblems(
  content: Pick<DraftContent, "title" | "message" | "buttons">
): string[] {
  return [
    alertTitleProblem(content.title),
    alertMessageProblem(content.message),
    ...content.buttons.map((b, i) => alertButtonProblem(b.text, i)),
  ].filter((p): p is string => p !== null);
}

// The checks one content block gets, for the campaign's own and for each variant.
export function contentProblems(
  content: DraftContent,
  template: InAppTemplate,
  image: InAppDraft["image"]
): string[] {
  const kind = TEMPLATES[template];
  // The SDK always draws its own close control, so there is no trap to check for.
  if (kind.html) return htmlProblems(content.html);
  const message: string[] = [];
  if (!kind.imageOnly && !content.title.trim() && !content.message.trim())
    message.push("The message has no text yet. Add a title or a message.");
  if (kind.imageOnly && !image.portrait)
    message.push("This template shows only an image. Upload a portrait image.");
  for (const text of [content.title, content.message]) {
    const problem = bracesProblem(text);
    if (problem && !message.includes(problem)) message.push(problem);
  }
  const question = content.question;
  if (!kind.imageOnly && !question)
    content.buttons.forEach((button, i) => {
      if (!button.text.trim())
        message.push(
          `Button ${i + 1} has no label. Type the text people will tap.`
        );
      const problem = actionProblem(button.action);
      if (problem) message.push(`Button ${i + 1}: ${problem}`);
    });
  if (content.tapAction && !question) {
    const problem = actionProblem(content.tapAction);
    if (problem) message.push(`Tap on the message: ${problem}`);
  }
  const buttons = kind.imageOnly ? 0 : content.buttons.length;
  // With a question, answering is the way out.
  if (!question && !content.dismissible && buttons === 0 && !content.tapAction)
    message.push(
      'People have no way to close this message. Add a button or a tap action, or turn on "People can close it without answering".'
    );
  // The system alert has buttons only: a tap on it does nothing.
  if (
    !question &&
    template === "alert" &&
    !content.dismissible &&
    buttons === 0
  )
    message.push(
      'People have no way to close this alert. Add a button, or turn on "People can close it without answering".'
    );
  if (template === "alert") message.push(...alertLimitProblems(content));
  if (question)
    message.push(...questionProblems({ question, template }, question));
  return message;
}

// The server has the last word at launch; this catches what a person can fix before asking it.
export function draftProblems(draft: InAppDraft): SectionProblems {
  // With variants, A's problems are named too, so nobody hunts for them on B.
  const own = contentProblems(draft, draft.template, draft.image);
  const message = draft.variants.length
    ? own.map((p) => `Variant A: ${p}`)
    : own;
  const trigger: string[] = [];
  const audience: string[] = [];
  const experiment: string[] = [];
  const limits: string[] = [];

  if (draft.conversion && !goalReady(draft.conversion))
    experiment.push(goalProblem(draft.conversion));
  // Variants are written in the message step, so their problems sit with it.
  for (const variant of draft.variants)
    for (const problem of contentProblems(
      variant.content,
      draft.template,
      draft.image
    ))
      message.push(`Variant ${variant.id.toUpperCase()}: ${problem}`);

  if (draft.triggers.length === 0)
    trigger.push("Choose when the message shows: add at least one trigger.");
  draft.triggers.forEach((t, i) => {
    if (t.type === "event" && !t.name.trim())
      trigger.push(
        `Trigger ${i + 1}: choose the event that shows the message.`
      );
    if (t.type === "event")
      (t.filters ?? []).forEach((f) => {
        if (!f.field.trim())
          trigger.push(
            `Trigger ${i + 1}: a filter has no property. Pick one or remove the filter.`
          );
      });
  });

  if (draft.audience.type === "segment" && !draft.audience.segmentId)
    audience.push("Pick the segment to show it to, or choose Everyone.");
  draft.conditions.forEach((c, i) => {
    if (c.type === "event_count" && !c.name?.trim())
      audience.push(`Audience condition ${i + 1}: choose an event.`);
    if (c.type === "user_attribute" && !c.key?.trim())
      audience.push(`Audience condition ${i + 1}: choose an attribute.`);
    if (
      (c.type === "app_version" || c.type === "os_version") &&
      !String(c.value ?? "").trim()
    )
      audience.push(
        `Audience condition ${i + 1}: enter a version, such as 2.1.0.`
      );
    const counted =
      c.type === "event_count" ||
      (c.type === "first_seen" && c.op === "within_days");
    if (counted && !Number.isInteger(c.value))
      audience.push(`Audience condition ${i + 1}: enter a whole number.`);
  });

  const start = draft.startAt ? new Date(draft.startAt).getTime() : null;
  const end = draft.endAt ? new Date(draft.endAt).getTime() : null;
  if (end !== null && end <= (start ?? Date.now()))
    limits.push(
      start === null
        ? "The end date has already passed. Pick a later end, or Until I end it."
        : "The end is before the start. Pick an end after the start."
    );
  if ((draft.from === "") !== (draft.to === ""))
    limits.push("Set both the From and To hours, or choose All day.");
  for (const key of ["day", "week"] as const) {
    const cap = draft.caps[key];
    if (cap !== null && cap > 20)
      limits.push(`At most 20 per ${key}. Lower the per ${key} limit.`);
  }

  return { message, trigger, audience, experiment, limits, review: [] };
}

// What may still be fine but is worth a look, such as media that makes the message jump.
export function draftWarnings(draft: InAppDraft): string[] {
  if (!TEMPLATES[draft.template].html) return [];
  return [
    ...htmlWarnings(draft.html),
    ...draft.variants.flatMap((v) =>
      htmlWarnings(v.content.html).map(
        (w) => `Variant ${v.id.toUpperCase()}: ${w}`
      )
    ),
  ];
}

export const CONTROL_GROUPS = [0, 5, 10, 20, 50] as const;
export const PROJECT_CONTROL_GROUPS = [0, 1, 2, 5, 10, 20] as const;

export const windowLabel = (hours: InAppConversionWindow) =>
  hours === 24 ? "1 day" : `${hours / 24} days`;

export const goalProblem = (goal: InAppConversion) =>
  goal.purchase
    ? "Choose at least one product, or count any product."
    : goalKind(goal) === "system"
      ? "Choose the built-in event that counts as a conversion."
      : goalKind(goal) === "screen"
        ? "Choose the screen that counts as a conversion."
        : "Choose the event that counts as a conversion.";

// "checkout within 3 days" or "the Checkout screen within 3 days", for the review step and the report.
export const goalSubject = (goal: InAppConversion) =>
  goal.purchase
    ? goal.products?.length
      ? `a purchase of ${goal.products.join(", ")}`
      : "a purchase"
    : goal.system
      ? (SYSTEM_EVENT_INFO[goal.system]?.label ?? goal.system)
      : goalKind(goal) === "screen"
        ? `the ${goal.screen} screen`
        : (goal.event ?? "");

export const goalLabel = (goal: InAppConversion) =>
  `${goalSubject(goal)} within ${windowLabel(goal.window_hours)}`;

// The variant named by the first message problem about one, if any.
// The variant a message problem is about, from its "Variant X:" prefix.
export function variantOf(problem: string): VariantKey | null {
  const m = /^Variant ([ABC]):/.exec(problem);
  return m ? (m[1]!.toLowerCase() as VariantKey) : null;
}

export function problemVariant(problems: SectionProblems): VariantKey | null {
  for (const p of problems.message) {
    const v = variantOf(p);
    if (v) return v;
  }
  return null;
}

export const hasProblems = (problems: SectionProblems) =>
  Object.values(problems).some((list) => list.length > 0);

export function firstProblemSection(
  problems: SectionProblems
): InAppSection | null {
  return IN_APP_SECTIONS.find((s) => problems[s].length > 0) ?? null;
}

// Puts a field where the cursor is, replacing what is selected.
export function insertAt(
  text: string,
  field: string,
  start: number | null,
  end: number | null
): string {
  const from = Math.min(start ?? text.length, text.length);
  const to = Math.max(from, Math.min(end ?? from, text.length));
  return text.slice(0, from) + field + text.slice(to);
}

export function fieldText(
  source: "user" | "event",
  key: string,
  fallback: string
): string {
  const clean = fallback.replace(/["{}]/g, "").trim();
  return clean
    ? `{{ ${source}.${key} | default: "${clean}" }}`
    : `{{ ${source}.${key} }}`;
}

// A key a device can read: letters, digits and _ only.
export const usableKey = (key: string) => /^[A-Za-z0-9_]+$/.test(key);

export const DELAYS = [0, 1, 2, 3, 5, 10, 30, 60];

export const delayLabel = (seconds: number): string =>
  seconds === 0
    ? "Right away"
    : seconds % 60 === 0
      ? `After ${seconds / 60} minute${seconds === 60 ? "" : "s"}`
      : `After ${seconds} second${seconds === 1 ? "" : "s"}`;

// A ready-made start for the message most apps need sooner or later.
export const updateDraft = (): InAppDraft => ({
  ...emptyDraft(),
  name: "Ask people to update",
  title: "A new version is ready",
  message: "Update to get the latest features and fixes.",
  buttons: [
    { id: "update", text: "Update", action: { type: "open_store" } },
    { id: "later", text: "Later", action: { type: "close" } },
  ],
  triggers: [{ type: "app_open" }],
  conditions: [{ type: "app_version", op: "lt", value: "" }],
  caps: {
    session: 1,
    day: null,
    week: null,
    lifetime: null,
    ignore_global: true,
  },
  priority: 10,
});

// Ids are what the report shows per button, so they stay put once given.
export function nextButtonId(buttons: InAppButton[]): string {
  const used = new Set(buttons.map((b) => b.id));
  let n = 1;
  while (used.has(`button_${n}`)) n += 1;
  return `button_${n}`;
}

export const rateDraft = (): InAppDraft => ({
  ...emptyDraft(),
  name: "Rate the app",
  template: "footer",
  title: "Enjoying the app?",
  question: {
    ...blankQuestion("stars"),
    low: LOW_QUESTION.stars,
    reviewFrom: 4,
    thanks: "Thank you",
  },
  caps: {
    session: 1,
    day: null,
    // The closest limit there is to once in 30 days.
    week: 1,
    lifetime: null,
    ignore_global: false,
  },
});

export const quickQuestionDraft = (): InAppDraft => ({
  ...emptyDraft(),
  name: "Quick question",
  template: "half_interstitial",
  title: "What would you like to see next?",
  question: {
    ...blankQuestion("choice"),
    options: [
      { id: "option_1", text: "Option 1" },
      { id: "option_2", text: "Option 2" },
    ],
  },
});
