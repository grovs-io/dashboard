"use client";
import type { ReactNode } from "react";
import { format } from "date-fns";
import {
  CalendarClock,
  FlaskConical,
  Lock,
  Repeat,
  Target,
  Users,
  Zap,
} from "lucide-react";
import SplitOverview from "@ee/components/experiments/SplitOverview";
import { VALUE_OPS } from "@ee/components/in_app/composer/TriggerSection";
import { goalSubject } from "@ee/lib/inAppComposer";
import { entryLabel, type JourneyFocus } from "@ee/lib/journeys";
import type { InAppFilter } from "@ee/types/inApp";
import type { JourneyInput } from "@ee/types/journey";

export const LOCKED =
  "Fixed at launch so the results stay comparable. Duplicate the journey to change it.";

const filterLabel = (f: InAppFilter) => {
  const op = VALUE_OPS.find((o) => o.value === f.op)?.label ?? f.op;
  const value = Array.isArray(f.value)
    ? f.value.join(" and ")
    : (f.value ?? "");
  return `${f.field} ${op} ${value}`.trim();
};

const when = (iso: string | null, empty: string) =>
  iso ? format(new Date(iso), "EEE d MMM yyyy, HH:mm") : empty;

function Part({
  icon,
  title,
  locked,
  onEdit,
  children,
}: {
  icon: ReactNode;
  title: string;
  locked: boolean;
  onEdit?: () => void;
  children: ReactNode;
}) {
  const action = locked ? (
    <span
      title={LOCKED}
      aria-label={`${title}: ${LOCKED}`}
      className="self-start text-muted-foreground"
    >
      <Lock className="size-3.5" />
    </span>
  ) : (
    onEdit && (
      <button
        type="button"
        className="self-start text-xs font-medium text-primary hover:underline"
        aria-label={`Edit ${title.toLowerCase()}`}
        onClick={onEdit}
      >
        Edit
      </button>
    )
  );
  return (
    <section className="grid gap-x-4 gap-y-2 p-4 sm:grid-cols-[170px_1fr_auto]">
      <h4 className="flex items-center gap-2 self-start text-[13px] font-semibold">
        <span className="flex size-6 items-center justify-center rounded-md bg-accent text-primary">
          {icon}
        </span>
        {title}
      </h4>
      <div className="min-w-0 space-y-1.5 text-[13px] leading-relaxed [overflow-wrap:anywhere]">
        {children}
      </div>
      {action}
    </section>
  );
}

const Muted = ({ children }: { children: ReactNode }) => (
  <span className="text-muted-foreground">{children}</span>
);

// The journey's settings in plain words, each with a way into the builder while it is a draft.
export default function JourneySetup({
  journey,
  segmentName,
  projectControlGroup,
  onEdit,
}: {
  // A draft's own fields are enough; the status says whether they are fixed.
  journey: JourneyInput & { status: string };
  segmentName: (id: string) => string | null;
  projectControlGroup: number;
  onEdit?: (section: JourneyFocus) => void;
}) {
  const locked = journey.status !== "draft";
  const { entry, re_entry } = journey;
  const filters = entry.type === "event" ? (entry.event?.filters ?? []) : [];
  const part = (
    icon: ReactNode,
    title: string,
    children: ReactNode,
    section: JourneyFocus = "entry"
  ) => (
    <Part
      icon={icon}
      title={title}
      locked={locked}
      onEdit={onEdit && (() => onEdit(section))}
    >
      {children}
    </Part>
  );
  return (
    <div className="divide-y divide-sidebar-border rounded-lg border border-sidebar-border bg-background">
      {part(
        <Zap className="size-3.5" />,
        "Entry",
        <>
          <p>{entryLabel(entry, segmentName)}</p>
          {filters.length > 0 && (
            <p>
              <Muted>Only when </Muted>
              {filters.map(filterLabel).join(", and ")}
            </p>
          )}
        </>
      )}
      {part(
        <Users className="size-3.5" />,
        "Who may enter",
        <p>
          {entry.audience_segment_id
            ? `People in ${segmentName(entry.audience_segment_id) ?? "a segment"}`
            : "Everyone"}
        </p>
      )}
      {part(
        <Repeat className="size-3.5" />,
        "Entering again",
        <p>
          {re_entry.mode === "once"
            ? "Only once, ever"
            : re_entry.mode === "after_exit"
              ? "Again after they leave"
              : `Again ${re_entry.days ?? "?"} days after they leave`}
        </p>
      )}
      {part(
        <Target className="size-3.5" />,
        "Goals",
        journey.goals.length ? (
          <>
            <p>{journey.goals.map(goalSubject).join(", ")}</p>
            <Muted>
              Reaching one takes someone out and counts as converted.
            </Muted>
          </>
        ) : (
          <Muted>No goal</Muted>
        ),
        "goals"
      )}
      {part(
        <FlaskConical className="size-3.5" />,
        "Control group",
        journey.control_group || projectControlGroup > 0 ? (
          <SplitOverview
            controlGroup={journey.control_group}
            variants={0}
            projectControlGroup={projectControlGroup}
            labels={{ a: "In the journey" }}
          />
        ) : (
          <Muted>None</Muted>
        ),
        "overview"
      )}
      {part(
        <CalendarClock className="size-3.5" />,
        "Schedule",
        <p>
          <Muted>From </Muted>
          {when(journey.start_at, "launch")}
          <Muted> until </Muted>
          {when(journey.end_at, "ended by hand")}
        </p>,
        "overview"
      )}
    </div>
  );
}
