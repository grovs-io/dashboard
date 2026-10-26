"use client";
import type { ReactNode } from "react";
import { format } from "date-fns";
import {
  CalendarClock,
  FlaskConical,
  Gauge,
  MessageSquareText,
  Users,
  Zap,
} from "lucide-react";
import {
  ACTION_LABELS,
  LAYOUT_LABELS,
  ORIENTATION_LABELS,
  TEMPLATES,
  triggerLabel,
} from "@ee/lib/inApp";
import {
  delayLabel,
  goalLabel,
  isDark,
  questionSentences,
} from "@ee/lib/inAppComposer";
import type { InAppDraft, InAppSection } from "@ee/lib/inAppComposer";
import { goalReady } from "@ee/types/experiment";
import type { InAppAction, InAppCondition } from "@ee/types/inApp";
import SplitOverview from "@ee/components/experiments/SplitOverview";
import { previewText } from "./composer/MessagePreview";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const OPS: Record<string, string> = {
  eq: "is",
  neq: "is not",
  gt: "above",
  lt: "below",
  between: "between",
  contains: "contains",
  not_contains: "does not contain",
  is_set: "is set",
  is_not_set: "is not set",
  within_days: "in the last",
  before: "before",
  after: "after",
};
const PLATFORMS: Record<string, string> = {
  ios: "iOS",
  android: "Android",
  web: "Web",
};
const SUBJECTS: Record<InAppCondition["type"], string> = {
  platform: "Platform",
  language: "Language",
  app_version: "App version",
  os_version: "OS version",
  event_count: "Times",
  user_attribute: "Attribute",
  first_seen: "First seen",
};

export function conditionLabel(c: InAppCondition): string {
  const subject =
    c.type === "event_count"
      ? `Times "${c.name}" happened`
      : c.type === "user_attribute"
        ? `Attribute "${c.key}"`
        : SUBJECTS[c.type];
  const value =
    c.type === "platform"
      ? (PLATFORMS[String(c.value)] ?? String(c.value))
      : Array.isArray(c.value)
        ? c.value.join(" and ")
        : c.value === undefined
          ? ""
          : String(c.value).slice(0, c.type === "first_seen" ? 10 : 80);
  const unit = c.op === "within_days" ? " days" : "";
  return `${subject} ${OPS[c.op] ?? c.op} ${value}${unit}`.trim();
}

const actionLabel = (action: InAppAction) =>
  action.type === "open_url" && action.url
    ? `Opens ${action.url}`
    : ACTION_LABELS[action.type];

const when = (value: string, empty: string) =>
  value ? format(new Date(value), "EEE d MMM yyyy, HH:mm") : empty;

function caps(draft: InAppDraft): string[] {
  const out = [
    draft.caps.session && `${draft.caps.session} per session`,
    draft.caps.day && `${draft.caps.day} per day`,
    draft.caps.week && `${draft.caps.week} per week`,
    draft.caps.lifetime && `${draft.caps.lifetime} ever`,
  ].filter((x): x is string => !!x);
  return out.length ? out : ["No limit"];
}

function Part({
  icon,
  title,
  section,
  onEdit,
  children,
}: {
  icon: ReactNode;
  title: string;
  section: InAppSection;
  onEdit?: (section: InAppSection) => void;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-x-4 gap-y-2 p-4 sm:grid-cols-[150px_1fr_auto]">
      <h4 className="flex items-center gap-2 self-start text-[13px] font-semibold">
        <span className="flex size-6 items-center justify-center rounded-md bg-accent text-primary">
          {icon}
        </span>
        {title}
      </h4>
      <div className="min-w-0 space-y-1.5 text-[13px] leading-relaxed [overflow-wrap:anywhere]">
        {children}
      </div>
      {onEdit && (
        <button
          type="button"
          className="self-start text-xs font-medium text-primary hover:underline"
          aria-label={`Edit ${title.toLowerCase()}`}
          onClick={() => onEdit(section)}
        >
          Edit
        </button>
      )}
    </section>
  );
}

const Muted = ({ children }: { children: ReactNode }) => (
  <span className="text-muted-foreground">{children}</span>
);

const Chips = ({ items }: { items: string[] }) => (
  <span className="flex flex-wrap gap-1.5">
    {items.map((item) => (
      <span
        key={item}
        className="rounded-md bg-muted px-2 py-0.5 text-xs [overflow-wrap:anywhere]"
      >
        {item}
      </span>
    ))}
  </span>
);

function Swatches({ draft }: { draft: InAppDraft }) {
  const colors = [
    draft.colors.background,
    draft.colors.title,
    draft.colors.message,
  ].filter((c): c is string => !!c);
  if (colors.length === 0) return null;
  return (
    <p className="flex items-center gap-1.5">
      <Muted>Colours</Muted>
      {colors.map((color, i) => (
        <span
          key={`${color}-${i}`}
          title={color}
          className="size-4 rounded-full border border-black/10"
          style={{ backgroundColor: color }}
        />
      ))}
      <Muted>
        {draft.colors.background && isDark(draft.colors.background)
          ? "dark"
          : "custom"}
      </Muted>
    </p>
  );
}

function schedule(draft: InAppDraft): string {
  const days = draft.days.length
    ? [...draft.days]
        .sort((a, b) => a - b)
        .map((d) => DAYS[d - 1])
        .join(", ")
    : null;
  const hours = draft.from && draft.to ? `${draft.from} to ${draft.to}` : null;
  if (!days && !hours) return "At any time of day, every day.";
  return `Only ${[days, hours].filter(Boolean).join(", ")}, by the clock of each device.`;
}

// The same facts in the composer's review step and on the report page.
export default function InAppSummary({
  draft,
  segmentName,
  projectControlGroup = 0,
  audience,
  onEdit,
}: {
  draft: InAppDraft;
  segmentName?: string | null;
  projectControlGroup?: number;
  // Devices, when the report knows them.
  audience?: number | null;
  onEdit?: (section: InAppSection) => void;
}) {
  const kind = TEMPLATES[draft.template];
  const size = "size-3.5";
  const images = [
    draft.image.portrait && "portrait",
    draft.image.landscape && "landscape",
  ].filter(Boolean);
  return (
    <div className="divide-y divide-sidebar-border rounded-lg border border-sidebar-border bg-background">
      <Part
        icon={<MessageSquareText className={size} />}
        title="Message"
        section="message"
        onEdit={onEdit}
      >
        <p>
          {kind.label} <Muted>· {kind.hint.toLowerCase()}</Muted>
        </p>
        {kind.html && (
          <p>
            <Muted>Layout</Muted> {LAYOUT_LABELS[draft.layout]}
          </p>
        )}
        {!kind.html && !kind.imageOnly && draft.title && (
          <p className="font-medium">{previewText(draft.title)}</p>
        )}
        {!kind.html && !kind.imageOnly && draft.message && (
          <p className="line-clamp-3 whitespace-pre-line text-muted-foreground">
            {previewText(draft.message)}
          </p>
        )}
        {kind.image && (
          <p>
            <Muted>Image</Muted> {images.length ? images.join(" and ") : "none"}
          </p>
        )}
        {draft.question && (
          <>
            <p>{questionSentences(draft.question).join(" ")}</p>
            <p>
              <Muted>A person who has answered is not asked again.</Muted>
            </p>
          </>
        )}
        {!kind.html &&
          !kind.imageOnly &&
          !draft.question &&
          draft.buttons.map((button) => (
            <p key={button.id}>
              <span className="rounded-md border border-sidebar-border px-2 py-0.5 text-xs font-medium">
                {button.text || "No label"}
              </span>{" "}
              <Muted>{lower(actionLabel(button.action))}</Muted>
            </p>
          ))}
        {!kind.html && draft.tapAction && !draft.question && (
          <p>
            <Muted>A tap on the message</Muted>{" "}
            {lower(actionLabel(draft.tapAction))}
          </p>
        )}
        {!kind.html && !draft.dismissible && (
          <p>
            <Muted>Stays until</Muted>{" "}
            {draft.question
              ? "the question is answered"
              : "a button or the message is tapped"}
          </p>
        )}
        {!kind.html && <Swatches draft={draft} />}
        {draft.variants.length > 0 && (
          <p>
            <Muted>Variants</Muted>{" "}
            {`${draft.variants.length + 1}: A, ${draft.variants
              .map((v) => v.id.toUpperCase())
              .join(", ")}`}
          </p>
        )}
      </Part>

      <Part
        icon={<Zap className={size} />}
        title="Trigger"
        section="trigger"
        onEdit={onEdit}
      >
        {draft.triggers.length ? (
          <>
            <p>
              <Muted>
                Shows when {draft.triggers.length > 1 ? "any of these" : "this"}{" "}
                happens
              </Muted>
            </p>
            <Chips items={draft.triggers.map(triggerLabel)} />
          </>
        ) : (
          <p>No trigger yet</p>
        )}
        <p>
          <Muted>Appears</Muted> {lower(delayLabel(draft.delaySeconds))}
        </p>
      </Part>

      <Part
        icon={<Users className={size} />}
        title="Audience"
        section="audience"
        onEdit={onEdit}
      >
        <p>
          {draft.audience.type === "segment"
            ? `People in ${segmentName ?? "a segment not chosen yet"}`
            : "Everyone"}
        </p>
        {draft.conditions.length > 0 && (
          <>
            <p>
              <Muted>On devices where all of these hold</Muted>
            </p>
            <Chips items={draft.conditions.map(conditionLabel)} />
          </>
        )}
      </Part>

      <Part
        icon={<FlaskConical className={size} />}
        title="Experiment"
        section="experiment"
        onEdit={onEdit}
      >
        <p>
          <Muted>Goal</Muted>{" "}
          {draft.conversion && goalReady(draft.conversion)
            ? goalLabel(draft.conversion)
            : "none"}
        </p>
        <p>
          <Muted>Control group</Muted>{" "}
          {draft.controlGroup === null
            ? "none"
            : `${draft.controlGroup}% never see it`}
        </p>
        <SplitOverview
          controlGroup={draft.controlGroup}
          variants={draft.variants.length}
          projectControlGroup={projectControlGroup}
          audience={audience}
        />
      </Part>

      <Part
        icon={<Gauge className={size} />}
        title="Limits"
        section="limits"
        onEdit={onEdit}
      >
        <p>
          <Muted>One person sees it at most</Muted>
        </p>
        <Chips items={caps(draft)} />
        <p>
          Priority {draft.priority} of 10
          {draft.caps.ignore_global && (
            <Muted> · not held back by the project limit</Muted>
          )}
        </p>
        {draft.orientation !== "any" && (
          <p>{ORIENTATION_LABELS[draft.orientation]}</p>
        )}
      </Part>

      <Part
        icon={<CalendarClock className={size} />}
        title="Schedule"
        section="limits"
        onEdit={onEdit}
      >
        <p>
          <Muted>Starts</Muted> {when(draft.startAt, "at launch")}
          <Muted> · ends</Muted> {when(draft.endAt, "when you end it")}
        </p>
        <p>{schedule(draft)}</p>
      </Part>
    </div>
  );
}

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
