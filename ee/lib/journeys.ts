import { ApiError } from "@/lib/ApiError";
import { dataRowsToObject, type PushContentFormValues } from "@/schemas/push";
import { TONE_CLASSES, type PushStatusTone } from "@ee/lib/push";
import { apnsPayloadBytes, soundMode, soundValue } from "@ee/lib/push";
import { TEMPLATES, inAppErrorText } from "@ee/lib/inApp";
import {
  draftContent,
  draftInput,
  draftProblems,
  emptyDraft,
  goalProblem,
  goalSubject,
  type InAppDraft,
} from "@ee/lib/inAppComposer";
import { SYSTEM_EVENT_INFO, goalInput, goalReady } from "@ee/types/experiment";
import type { ExperimentGroupId } from "@ee/types/experiment";
import type {
  BranchKey,
  InAppJourneyStep,
  JourneyEntry,
  JourneyEvent,
  JourneyInput,
  JourneyStatus,
  JourneyStep,
  PercentSplitStep,
  PushStep,
  SplitCondition,
  SplitStep,
  StepType,
  WaitStep,
  WaitUntil,
} from "@ee/types/journey";

export { TONE_CLASSES };
export const journeyErrorText = inAppErrorText;

export const MAX_STEPS = 60;
export const MAX_GOALS = 3;
const MIN_WAIT = 5;
export const MAX_WAIT = 43_200;
export const MAX_PATHS = 3;

export const STEP_TYPES: readonly StepType[] = [
  "wait",
  "split",
  "push",
  "in_app",
  "set_attribute",
];

export const STEP_LABELS: Record<StepType, string> = {
  wait: "Wait",
  split: "Split",
  push: "Send push",
  in_app: "Show in-app",
  set_attribute: "Set attribute",
};

export const STEP_HINTS: Record<StepType, string> = {
  wait: "For a time, or until they do something",
  split: "Send people down different paths",
  push: "A push notification",
  in_app: "A message inside the app",
  set_attribute: "Remember something about them",
};

const STATUS_LABELS: Record<JourneyStatus, string> = {
  draft: "Draft",
  live: "Live",
  paused: "Paused",
  ended: "Ended",
};
const STATUS_TONES: Record<JourneyStatus, PushStatusTone> = {
  draft: "grey",
  live: "green",
  paused: "grey",
  ended: "grey",
};
export const journeyStatusLabel = (s: JourneyStatus) => STATUS_LABELS[s];
export const journeyStatusTone = (s: JourneyStatus) => STATUS_TONES[s];
export const isJourneyStatus = (v: string): v is JourneyStatus =>
  v in STATUS_LABELS;

// A 404 alone can be a missing journey; only this message means the feature is off.
export const isJourneysNotEnabled = (error: unknown) =>
  error instanceof ApiError &&
  error.status === 404 &&
  /not enabled/i.test(inAppErrorText(error, ""));

type Status = { status: JourneyStatus };
export const canPause = (j: Status) => j.status === "live";
export const canResume = (j: Status) => j.status === "paused";
export const canEnd = (j: Status) =>
  j.status === "live" || j.status === "paused";
export const canEdit = (j: Status) => j.status !== "ended";
// After launch only content, wait times, percentages and the name may change.
export const isLocked = (j: Status | null | undefined) =>
  !!j && j.status !== "draft";

export const emptyJourney = (): JourneyInput => ({
  name: "",
  entry: {
    type: "event",
    event: { name: "", filters: [] },
    segment_id: null,
    audience_segment_id: null,
  },
  re_entry: { mode: "once", days: null },
  goals: [],
  control_group: null,
  start_at: null,
  end_at: null,
  first_step: null,
  steps: {},
});

export const journeyName = (draft: Pick<JourneyInput, "name">) =>
  draft.name.trim() || "Untitled journey";

const STEP_KEYS: Record<StepType, readonly string[]> = {
  wait: ["minutes", "until", "next", "timeout_next"],
  split: ["mode"],
  push: [
    "title",
    "body",
    "link_id",
    "image_url",
    "data",
    "sound",
    "quiet_hours",
    "next",
  ],
  in_app: ["template", "content", "triggers", "caps", "valid_days", "next"],
  set_attribute: ["key", "value", "next"],
};
const SPLIT_KEYS = {
  condition: ["condition", "yes_next", "no_next"],
  percent: ["paths"],
} as const;

// Exactly one of system, screen or name; built-in events take no filters.
function eventInput(event: JourneyEvent | null): JourneyEvent | null {
  if (!event) return event;
  if (event.system) return { system: event.system };
  // A filter without a property stays in the editor but is not sent.
  const filters = (event.filters ?? []).filter((f) => f.field.trim());
  if (event.screen != null) return { screen: event.screen, filters };
  // A draft may hold an event not chosen yet; launch reports it.
  if (!event.name) return {};
  return { name: event.name, filters };
}

function withEvents(step: JourneyStep): JourneyStep {
  if (step.type === "wait" && step.until?.kind === "event")
    return {
      ...step,
      until: { kind: "event", event: eventInput(step.until.event)! },
    };
  if (
    step.type === "split" &&
    step.mode === "condition" &&
    step.condition.kind === "event"
  )
    return {
      ...step,
      condition: {
        ...step.condition,
        event: eventInput(step.condition.event)!,
      },
    };
  return step;
}

// The server refuses any key a step type does not have, so only the contract's go out.
function stepInput(original: JourneyStep): JourneyStep {
  const step = withEvents(original);
  const keys = [
    "id",
    "type",
    ...STEP_KEYS[step.type],
    ...(step.type === "split" ? SPLIT_KEYS[step.mode] : []),
  ];
  return Object.fromEntries(
    keys.map((k) => [
      k,
      (step as unknown as Record<string, unknown>)[k] ?? null,
    ])
  ) as unknown as JourneyStep;
}

export const stepsInput = (steps: Record<string, JourneyStep>) =>
  Object.fromEntries(
    Object.entries(steps).map(([id, step]) => [id, stepInput(step)])
  );

// An audience filter still being chosen is saved as none.
export function journeyInput(draft: JourneyInput): JourneyInput {
  return {
    ...draft,
    name: journeyName(draft),
    steps: stepsInput(draft.steps),
    goals: draft.goals.map((g) => (g.purchase ? goalInput(g) : g)),
    entry: {
      ...draft.entry,
      event: eventInput(draft.entry.event),
      audience_segment_id: draft.entry.audience_segment_id || null,
    },
  };
}

// Fresh ids never collide with a step still in the map.
// The highest n of the s<n> ids among these steps; 0 without any.
export const highestStepId = (ids: Iterable<string>) =>
  Math.max(0, ...[...ids].map((id) => Number(/^s(\d+)$/.exec(id)?.[1] ?? 0)));

// Above every id in the map and above `after`, the highest this draft ever used.
function newStepId(steps: Record<string, JourneyStep>, after = 0): string {
  let n = Math.max(highestStepId(Object.keys(steps)), after) + 1;
  while (steps[`s${n}`]) n += 1;
  return `s${n}`;
}

export function inAppDraftOf(
  step: Pick<InAppJourneyStep, "template" | "content" | "triggers">
): InAppDraft {
  return {
    ...emptyDraft(),
    ...draftContent(step.content),
    template: step.template,
    image: {
      portrait: step.content.image?.portrait ?? null,
      landscape: step.content.image?.landscape ?? null,
    },
    orientation: step.content.orientation ?? "any",
    triggers: step.triggers,
  };
}

export function inAppFields(draft: InAppDraft) {
  const input = draftInput(draft, { withAudience: false });
  return {
    template: input.template!,
    content: input.content!,
    triggers: input.triggers!,
  };
}

export function pushFormValues(step: PushStep): PushContentFormValues {
  const mode = soundMode(step.sound);
  return {
    title: step.title,
    body: step.body,
    imageUrl: step.image_url ?? "",
    soundMode: mode,
    sound: mode === "custom" ? (step.sound ?? "") : "",
    linkId: step.link_id,
    data: Object.entries(step.data ?? {}).map(([key, value]) =>
      typeof value === "string"
        ? { key, value }
        : { key, value: JSON.stringify(value), original: value }
    ),
  };
}

export const pushFields = (values: PushContentFormValues) => ({
  title: values.title.trim(),
  body: values.body.trim(),
  image_url: values.imageUrl.trim() || null,
  sound: soundValue(values.soundMode, values.sound),
  link_id: values.linkId,
  data: dataRowsToObject(values.data),
});

export function createStep(type: StepType, id: string): JourneyStep {
  switch (type) {
    case "wait":
      return {
        id,
        type,
        minutes: 60,
        until: null,
        next: null,
        timeout_next: null,
      };
    case "split":
      return {
        id,
        type,
        mode: "condition",
        condition: {
          kind: "event",
          event: { name: "", filters: [] },
          days: 7,
          min_count: 1,
        },
        yes_next: null,
        no_next: null,
      };
    case "push":
      return {
        id,
        type,
        title: "",
        body: "",
        link_id: null,
        image_url: null,
        data: {},
        sound: "default",
        quiet_hours: false,
        next: null,
      };
    case "in_app": {
      const draft = emptyDraft();
      return {
        id,
        type,
        ...inAppFields(draft),
        caps: draft.caps,
        valid_days: 7,
        next: null,
      };
    }
    case "set_attribute":
      return { id, type, key: "journey_", value: "true", next: null };
  }
}

export interface Pointer {
  key: BranchKey;
  label: string | null;
  target: string | null;
}

export function pointers(step: JourneyStep): Pointer[] {
  if (step.type === "wait")
    return step.until
      ? [
          { key: "next", label: "Did it", target: step.next },
          {
            key: "timeout_next",
            label: "Time ran out",
            target: step.timeout_next,
          },
        ]
      : [{ key: "next", label: null, target: step.next }];
  if (step.type === "split")
    return step.mode === "condition"
      ? [
          { key: "yes_next", label: "Yes", target: step.yes_next },
          { key: "no_next", label: "No", target: step.no_next },
        ]
      : step.paths.map((p, i) => ({
          key: `path_${i}`,
          label: `Path ${i + 1} · ${p.percent}%`,
          target: p.next,
        }));
  return [{ key: "next", label: null, target: step.next }];
}

const PATH_GROUP_IDS: ExperimentGroupId[] = ["a", "b", "c"];

// A percent split's paths as the Experiment's a/b/c groups, labelled the same way as the steps table.
export function pathGroupLabels(
  step: PercentSplitStep
): Partial<Record<ExperimentGroupId, string>> {
  const labels: Partial<Record<ExperimentGroupId, string>> = {};
  pointers(step).forEach((p, i) => {
    const id = PATH_GROUP_IDS[i];
    if (id && p.label) labels[id] = p.label;
  });
  return labels;
}

function setPointer(
  step: JourneyStep,
  key: BranchKey,
  target: string | null
): JourneyStep {
  const path = /^path_(\d)$/.exec(key);
  if (path && step.type === "split" && step.mode === "percent")
    return {
      ...step,
      paths: step.paths.map((p, i) =>
        i === Number(path[1]) ? { ...p, next: target } : p
      ),
    };
  return { ...step, [key]: target } as JourneyStep;
}

// Where a link starts: a step's pointer, or the entry (from null) into the first step.
export interface Anchor {
  from: string | null;
  key: BranchKey;
}

function targetOf(draft: JourneyInput, anchor: Anchor): string | null {
  if (anchor.from === null) return draft.first_step;
  const step = draft.steps[anchor.from];
  return step
    ? (pointers(step).find((p) => p.key === anchor.key)?.target ?? null)
    : null;
}

function withTarget(
  draft: JourneyInput,
  anchor: Anchor,
  target: string | null
): JourneyInput {
  if (anchor.from === null) return { ...draft, first_step: target };
  const step = draft.steps[anchor.from];
  if (!step) return draft;
  return {
    ...draft,
    steps: { ...draft.steps, [step.id]: setPointer(step, anchor.key, target) },
  };
}

export function reachable(
  draft: JourneyInput,
  from: string | null
): Set<string> {
  const seen = new Set<string>();
  const stack = from ? [from] : [];
  while (stack.length) {
    const id = stack.pop()!;
    const step = draft.steps[id];
    if (seen.has(id) || !step) continue;
    seen.add(id);
    for (const p of pointers(step)) if (p.target) stack.push(p.target);
  }
  return seen;
}

// Drops every step the entry no longer leads to.
function prune(draft: JourneyInput): JourneyInput {
  const keep = reachable(draft, draft.first_step);
  if (keep.size === Object.keys(draft.steps).length) return draft;
  return {
    ...draft,
    steps: Object.fromEntries(
      Object.entries(draft.steps).filter(([id]) => keep.has(id))
    ),
  };
}

// The new step takes the link's place; what followed continues from its first path.
export function insertStep(
  draft: JourneyInput,
  anchor: Anchor,
  type: StepType,
  // The highest id number this draft has used, so a removed step's id is not reused.
  after = 0
): { draft: JourneyInput; id: string } {
  const id = newStepId(draft.steps, after);
  const created = createStep(type, id);
  const step = setPointer(
    created,
    pointers(created)[0]!.key,
    targetOf(draft, anchor)
  );
  const next = withTarget(
    { ...draft, steps: { ...draft.steps, [id]: step } },
    anchor,
    id
  );
  return { draft: next, id };
}

// Whatever led to the step leads to the path kept; the other paths go with it.
export function deleteStep(
  draft: JourneyInput,
  id: string,
  keep?: BranchKey
): JourneyInput {
  const step = draft.steps[id];
  if (!step) return draft;
  const paths = pointers(step);
  const rest = (paths.find((p) => p.key === keep) ?? paths[0])?.target ?? null;
  const steps: Record<string, JourneyStep> = {};
  for (const [key, other] of Object.entries(draft.steps)) {
    if (key === id) continue;
    let next = other;
    for (const p of pointers(other))
      if (p.target === id) next = setPointer(next, p.key, rest);
    // A wait for the removed push or in-app waits for nothing; its Time ran out path goes.
    if (
      next.type === "wait" &&
      next.until?.kind !== "event" &&
      next.until?.step === id
    )
      next = setUntil(next, null);
    steps[key] = next;
  }
  return prune({
    ...draft,
    first_step: draft.first_step === id ? rest : draft.first_step,
    steps,
  });
}

// Steps a path end may join without making a loop, in map order.
export function continueTargets(draft: JourneyInput, anchor: Anchor): string[] {
  return stepOrder(draft).filter(
    (id) => anchor.from === null || !reachable(draft, id).has(anchor.from)
  );
}

// Null when the pointer would loop back.
export function continueAt(
  draft: JourneyInput,
  anchor: Anchor,
  target: string
): JourneyInput | null {
  if (!draft.steps[target]) return null;
  if (anchor.from !== null && reachable(draft, target).has(anchor.from))
    return null;
  return withTarget(draft, anchor, target);
}

export function updateStep(
  draft: JourneyInput,
  step: JourneyStep
): JourneyInput {
  return prune({ ...draft, steps: { ...draft.steps, [step.id]: step } });
}

// How many steps a change would drop, besides the one removed.
export const lostSteps = (before: JourneyInput, after: JourneyInput) =>
  Object.keys(before.steps).length - Object.keys(after.steps).length;

// Waits whose "until they open/click" points at this step.
export const waitsOn = (draft: JourneyInput, id: string) =>
  Object.values(draft.steps).filter(
    (s) =>
      s.type === "wait" && s.until?.kind !== "event" && s.until?.step === id
  );

// Even whole percents, the remainder on the first: 34/33/33.
export function evenPaths<T extends { percent: number }>(paths: T[]): T[] {
  const base = Math.floor(100 / paths.length);
  return paths.map((p, i) => ({
    ...p,
    percent: base + (i === 0 ? 100 - base * paths.length : 0),
  }));
}

export function setUntil(step: WaitStep, until: WaitUntil | null): WaitStep {
  return { ...step, until, timeout_next: until ? step.timeout_next : null };
}

export function setSplitMode(
  step: SplitStep,
  mode: SplitStep["mode"]
): SplitStep {
  if (step.mode === mode) return step;
  if (step.mode === "condition")
    return {
      id: step.id,
      type: "split",
      mode: "percent",
      paths: [
        { percent: 50, next: step.yes_next },
        { percent: 50, next: step.no_next },
      ],
    };
  return {
    id: step.id,
    type: "split",
    mode: "condition",
    condition: createCondition("event"),
    yes_next: step.paths[0]?.next ?? null,
    no_next: step.paths[1]?.next ?? null,
  };
}

export function createCondition(kind: SplitCondition["kind"]): SplitCondition {
  switch (kind) {
    case "event":
      return { kind, event: { name: "", filters: [] }, days: 7, min_count: 1 };
    case "segment":
      return { kind, segment_id: null };
    case "attribute":
      return { kind, key: "", op: "eq", value: "" };
    case "platform":
      return { kind, values: ["ios", "android"] };
  }
}

// Every step in the order a reader meets it: depth first, paths left to right.
export function stepOrder(draft: JourneyInput): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string | null) => {
    if (!id || seen.has(id) || !draft.steps[id]) return;
    seen.add(id);
    order.push(id);
    for (const p of pointers(draft.steps[id]!)) visit(p.target);
  };
  visit(draft.first_step);
  return order;
}

const stepNumbers = (draft: JourneyInput) =>
  new Map(stepOrder(draft).map((id, i) => [id, i + 1]));

export function stepLabel(draft: JourneyInput, id: string): string {
  const step = draft.steps[id];
  const number = stepNumbers(draft).get(id);
  return step
    ? `${number ?? "?"}. ${STEP_LABELS[step.type]}`
    : "a removed step";
}

export interface LayoutLink {
  anchor: Anchor;
  label: string | null;
  target: string | null;
  // The step drawn under this link; null at a path end or a join.
  node: LayoutNode | null;
  // A step drawn under another parent, which this path continues at.
  join: string | null;
}

export interface LayoutNode {
  id: string;
  links: LayoutLink[];
}

// A step reached from several parents is drawn once, under the first in depth-first order.
export function layout(draft: JourneyInput): LayoutLink {
  const drawn = new Set<string>();
  const visit = (
    anchor: Anchor,
    label: string | null,
    target: string | null
  ): LayoutLink => {
    const step = target ? draft.steps[target] : undefined;
    if (!target || !step)
      return { anchor, label, target: null, node: null, join: null };
    if (drawn.has(target))
      return { anchor, label, target, node: null, join: target };
    drawn.add(target);
    return {
      anchor,
      label,
      target,
      join: null,
      node: {
        id: target,
        links: pointers(step).map((p) =>
          visit({ from: target, key: p.key }, p.label, p.target)
        ),
      },
    };
  };
  return visit({ from: null, key: "first_step" }, null, draft.first_step);
}

function durationLabel(minutes: number): string {
  const plural = (n: number, unit: string) =>
    `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (minutes > 0 && minutes % 1440 === 0) return plural(minutes / 1440, "day");
  if (minutes > 0 && minutes % 60 === 0) return plural(minutes / 60, "hour");
  return plural(minutes, "minute");
}

export const eventLabel = (event: JourneyEvent | null | undefined) =>
  event?.system
    ? SYSTEM_EVENT_INFO[event.system].label
    : event?.screen != null
      ? event.screen
        ? `the ${event.screen} screen`
        : "a screen"
      : event?.name || "an event";

export function entryLabel(
  entry: JourneyEntry,
  segmentName: (id: string) => string | null = () => null
): string {
  if (entry.type === "segment")
    return `When someone joins ${
      (entry.segment_id && segmentName(entry.segment_id)) || "a segment"
    }`;
  return entry.event?.screen != null
    ? `When someone views ${eventLabel(entry.event)}`
    : entry.event?.system
      ? `When someone ${SYSTEM_EVENT_INFO[entry.event.system].third}`
      : `When someone does ${eventLabel(entry.event)}`;
}

const PLATFORM_LABELS = { ios: "iOS", android: "Android", web: "Web" } as const;
const OP_WORDS: Record<string, string> = {
  eq: "is",
  neq: "is not",
  contains: "contains",
  gt: "is more than",
  lt: "is less than",
};

export function conditionLabel(
  condition: SplitCondition,
  segmentName: (id: string) => string | null = () => null
): string {
  switch (condition.kind) {
    case "event":
      return condition.event.system
        ? `Did they ${SYSTEM_EVENT_INFO[condition.event.system].verb} in ${durationLabel(condition.days * 1440)}?`
        : `Did ${eventLabel(condition.event)} in ${durationLabel(condition.days * 1440)}?`;
    case "segment":
      return `In ${(condition.segment_id && segmentName(condition.segment_id)) || "a segment"}?`;
    case "attribute":
      if (condition.op === "exists")
        return `Has ${condition.key || "an attribute"}?`;
      if (condition.op === "not_exists")
        return `Has no ${condition.key || "attribute"}?`;
      return `${condition.key || "Attribute"} ${OP_WORDS[condition.op]} ${condition.value ?? ""}?`;
    case "platform":
      return `On ${condition.values.map((v) => PLATFORM_LABELS[v]).join(" or ") || "no platform"}?`;
  }
}

// One line for the step's card on the map.
export function stepSummary(
  draft: JourneyInput,
  step: JourneyStep,
  segmentName: (id: string) => string | null = () => null
): string {
  switch (step.type) {
    case "wait": {
      const time = durationLabel(step.minutes);
      if (!step.until) return time;
      if (step.until.kind === "event")
        return step.until.event.system
          ? `Up to ${time}, until they ${SYSTEM_EVENT_INFO[step.until.event.system].verb}`
          : `Up to ${time}, until ${eventLabel(step.until.event)}`;
      const verb = step.until.kind === "opened" ? "open" : "click";
      const which = draft.steps[step.until.step]
        ? stepLabel(draft, step.until.step)
        : "a step above";
      return `Up to ${time}, until they ${verb} ${which}`;
    }
    case "split":
      return step.mode === "percent"
        ? step.paths.map((p) => `${p.percent}%`).join(" · ")
        : conditionLabel(step.condition, segmentName);
    case "push":
      return step.title || "No title yet";
    case "in_app":
      return `${TEMPLATES[step.template].label}${
        step.content.title ? `: ${step.content.title}` : ""
      }`;
    case "set_attribute":
      return `${step.key} = ${step.value}`;
  }
}

const whole = (n: unknown): n is number => Number.isInteger(n);
const KEY = /^journey_[a-z0-9_]{1,40}$/;
const HTTPS = /^https:\/\/[^\s]+$/;

function eventProblems(
  event: JourneyEvent | null | undefined,
  what: string
): string[] {
  const out: string[] = [];
  if (event?.system) return out;
  const screen = event?.screen != null;
  if (!(screen ? event?.screen : event?.name)?.trim())
    out.push(
      screen ? `Choose the screen ${what}.` : `Choose the event ${what}.`
    );
  (event?.filters ?? []).forEach((f, i) => {
    if (!f.field.trim()) out.push(`Filter ${i + 1} has no property.`);
    else if (!/^[A-Za-z0-9_]+$/.test(f.field.trim()))
      out.push(
        `Filter ${i + 1}: use letters, digits and _ only in the property name.`
      );
  });
  return out;
}

function conditionProblems(c: SplitCondition): string[] {
  switch (c.kind) {
    case "event": {
      const out = eventProblems(c.event, "to check");
      if (!whole(c.days) || c.days < 1 || c.days > 90)
        out.push("Check 1 to 90 days back.");
      if (!whole(c.min_count) || c.min_count < 1)
        out.push("The count is a whole number, 1 or more.");
      return out;
    }
    case "segment":
      return c.segment_id ? [] : ["Choose a segment."];
    case "attribute": {
      const out: string[] = [];
      if (!c.key.trim()) out.push("Choose an attribute.");
      else if (!/^[A-Za-z0-9_]{1,64}$/.test(c.key))
        out.push("The attribute uses letters, digits and _ only, up to 64.");
      if (
        c.op !== "exists" &&
        c.op !== "not_exists" &&
        !String(c.value ?? "").trim()
      )
        out.push("Enter a value to compare with.");
      return out;
    }
    case "platform":
      return c.values.length ? [] : ["Choose at least one platform."];
  }
}

function stepProblems(
  draft: JourneyInput,
  step: JourneyStep,
  above: Set<string>,
  launched: boolean
): string[] {
  const out: string[] = [];
  for (const p of pointers(step))
    if (p.target && !draft.steps[p.target])
      out.push("A path leads to a step that no longer exists.");
  switch (step.type) {
    case "wait": {
      if (
        !whole(step.minutes) ||
        step.minutes < MIN_WAIT ||
        step.minutes > MAX_WAIT
      )
        out.push("Wait between 5 minutes and 30 days.");
      const until = step.until;
      if (until?.kind === "event")
        out.push(...eventProblems(until.event, "to wait for"));
      if (until && until.kind !== "event") {
        const want = until.kind === "opened" ? "push" : "in_app";
        const target = draft.steps[until.step];
        if (!target || target.type !== want || !above.has(until.step))
          out.push(
            want === "push"
              ? "Choose a push step above this one."
              : "Choose an in-app step above this one."
          );
      }
      break;
    }
    case "split":
      if (step.mode === "percent") {
        if (step.paths.length < 2 || step.paths.length > MAX_PATHS)
          out.push("A split has 2 or 3 paths.");
        // After launch a path may go to 0% to send everyone down the others (the winner).
        if (
          step.paths.some(
            (p) => !whole(p.percent) || p.percent < (launched ? 0 : 1)
          )
        )
          out.push(
            launched
              ? "Each path is a whole percent."
              : "Each path is a whole percent, at least 1%."
          );
        else if (step.paths.reduce((sum, p) => sum + p.percent, 0) !== 100)
          out.push("The paths must add up to 100%.");
      } else out.push(...conditionProblems(step.condition));
      break;
    case "push": {
      if (!step.title.trim()) out.push("Write a title.");
      else if (step.title.length > 255)
        out.push("The title is at most 255 characters.");
      if (!step.body.trim()) out.push("Write a body.");
      else if (step.body.length > 1000)
        out.push("The body is at most 1000 characters.");
      if (step.image_url && !HTTPS.test(step.image_url))
        out.push("The image URL must start with https://");
      const bytes = apnsPayloadBytes({
        title: step.title,
        body: step.body,
        data: step.data,
        link: null,
        image: step.image_url,
        sound: step.sound,
      });
      if (bytes > 4096)
        out.push("The push is too large for Apple. Shorten it.");
      break;
    }
    case "in_app": {
      const found = draftProblems(inAppDraftOf(step));
      out.push(...found.message, ...found.trigger);
      if (
        !whole(step.valid_days) ||
        step.valid_days < 1 ||
        step.valid_days > 30
      )
        out.push("Keep it for 1 to 30 days.");
      break;
    }
    case "set_attribute":
      if (!KEY.test(step.key))
        out.push("The key starts with journey_ and uses a-z, 0-9 and _ only.");
      if (step.value.length > 255)
        out.push("The value is at most 255 characters.");
      break;
  }
  return out;
}

// What the editor's side panel shows: a card's editor, or the overview.
export type JourneyFocus = "entry" | "goals" | "overview";

export interface JourneyProblems {
  // Everything outside the steps, in section order.
  settings: string[];
  entry: string[];
  goals: string[];
  // Control group and schedule, edited in the overview.
  overview: string[];
  // The map as a whole: no step, too many, a loop.
  map: string[];
  steps: Record<string, string[]>;
}

function hasCycle(draft: JourneyInput): boolean {
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): boolean => {
    if (state.get(id) === 1) return true;
    if (state.get(id) === 2 || !draft.steps[id]) return false;
    state.set(id, 1);
    for (const p of pointers(draft.steps[id]!))
      if (p.target && visit(p.target)) return true;
    state.set(id, 2);
    return false;
  };
  return Object.keys(draft.steps).some((id) => visit(id));
}

// Mirrors the server's launch checks; the server still has the last word.
export function problems(
  draft: JourneyInput,
  { launched = false }: { launched?: boolean } = {}
): JourneyProblems {
  const entryProblems: string[] = [];
  const goals: string[] = [];
  const overview: string[] = [];
  const map: string[] = [];
  const { entry } = draft;
  if (entry.type === "event")
    entryProblems.push(
      ...eventProblems(entry.event, "that starts the journey")
    );
  else if (!entry.segment_id)
    entryProblems.push("Choose the segment people enter from.");
  if (entry.audience_segment_id === "")
    entryProblems.push("Choose the segment who may enter.");
  if (
    draft.re_entry.mode === "after_days" &&
    (!whole(draft.re_entry.days) ||
      draft.re_entry.days < 1 ||
      draft.re_entry.days > 365)
  )
    entryProblems.push("Re-entry needs 1 to 365 days.");
  if (draft.goals.length > MAX_GOALS)
    goals.push("A journey has at most three goals.");
  for (const goal of draft.goals)
    if (!goalReady(goal)) goals.push(goalProblem(goal));
  const cg = draft.control_group;
  if (cg !== null && (!whole(cg) || cg < 1 || cg > 50))
    overview.push("The control group is 1% to 50%.");
  const start = draft.start_at ? new Date(draft.start_at).getTime() : null;
  const end = draft.end_at ? new Date(draft.end_at).getTime() : null;
  if (end !== null && end <= Date.now())
    overview.push("The end date has passed.");
  else if (end !== null && start !== null && end <= start)
    overview.push("The end must be after the start.");
  const count = Object.keys(draft.steps).length;
  if (!draft.first_step || !draft.steps[draft.first_step])
    map.push("Add at least one step.");
  if (count > MAX_STEPS) map.push(`A journey has at most ${MAX_STEPS} steps.`);
  if (hasCycle(draft)) map.push("The steps loop back on themselves.");

  const steps: Record<string, string[]> = {};
  for (const step of Object.values(draft.steps)) {
    const above = new Set(
      Object.keys(draft.steps).filter(
        (id) => id !== step.id && reachable(draft, id).has(step.id)
      )
    );
    const found = stepProblems(draft, step, above, launched);
    if (found.length) steps[step.id] = found;
  }
  return {
    settings: [...entryProblems, ...goals, ...overview, ...map],
    entry: entryProblems,
    goals,
    overview,
    map,
    steps,
  };
}

// Stable text of what the API would receive, to tell whether anything changed.
export function sameJourney(a: JourneyInput, b: JourneyInput): boolean {
  const text = (v: unknown): string =>
    JSON.stringify(v, (_k, value) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(
            Object.entries(value).sort(([x], [y]) => (x < y ? -1 : 1))
          )
        : value
    );
  return text(journeyInput(a)) === text(journeyInput(b));
}

// Steps above this one of a kind, for "until they open the push above".
export function stepsAbove(
  draft: JourneyInput,
  id: string,
  type: StepType
): string[] {
  return stepOrder(draft).filter(
    (other) =>
      other !== id &&
      draft.steps[other]?.type === type &&
      reachable(draft, other).has(id)
  );
}

const verbOf = (event: JourneyEvent | null | undefined): string =>
  event?.system
    ? SYSTEM_EVENT_INFO[event.system].verb
    : event?.screen
      ? `view the ${event.screen} screen`
      : `do ${event?.name || "the event"}`;

const day = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

// The launch confirm's one paragraph: who enters, what happens, how it ends.
export function launchSummary(
  draft: JourneyInput,
  segmentName: (id: string) => string | null,
  projectControlGroup: number
): string {
  const { entry, re_entry } = draft;
  const segment = (id: string | null) => (id && segmentName(id)) || "a segment";
  const when =
    entry.type === "segment"
      ? `join ${segment(entry.segment_id)}`
      : verbOf(entry.event);
  const who = entry.audience_segment_id
    ? `only people in ${segment(entry.audience_segment_id)}`
    : "everyone";
  const again =
    re_entry.mode === "once"
      ? "once"
      : re_entry.mode === "after_exit"
        ? "again after they leave"
        : `again after ${re_entry.days} days`;
  const count = Object.keys(draft.steps).length;
  const leave = draft.goals.length
    ? `leave when they ${draft.goals
        .map((g) =>
          g.purchase
            ? `make ${goalSubject(g)}`
            : verbOf(
                g.system
                  ? { system: g.system }
                  : g.screen !== undefined
                    ? { screen: g.screen }
                    : { name: g.event }
              )
        )
        .join(" or ")}`
    : "leave at the end";
  const parts = [
    `People enter when they ${when} — ${who}, ${again}.`,
    `They go through ${count} step${count === 1 ? "" : "s"} and ${leave}.`,
  ];
  if (draft.control_group)
    parts.push(
      `${draft.control_group}% are held back as a control group${
        projectControlGroup
          ? ` (plus the project's ${projectControlGroup}%)`
          : ""
      }.`
    );
  const start = draft.start_at
    ? `It starts on ${day(draft.start_at)}`
    : "It starts now";
  const end = draft.end_at
    ? ` and stops taking people on ${day(draft.end_at)}.`
    : " and runs until you end it.";
  parts.push(start + end);
  return parts.join(" ");
}

export const goalsLabel = (draft: Pick<JourneyInput, "goals">) =>
  draft.goals.length ? draft.goals.map(goalSubject).join(", ") : "None";
