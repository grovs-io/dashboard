"use client";
import StartEndRows from "@ee/components/shared/StartEndRows";
import type { ReactNode } from "react";
import { Plus, Trash2, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import SegmentSelect from "@ee/components/audience/SegmentSelect";
import ControlGroupField from "@ee/components/experiments/ControlGroupField";
import GoalField from "@ee/components/experiments/GoalField";
import SplitOverview from "@ee/components/experiments/SplitOverview";
import { Choice } from "@/components/composer/fields";
import OptionCard from "@/components/composer/OptionCard";
import { fromLocalInput, toLocalInput } from "@ee/lib/inAppComposer";
import { MAX_GOALS } from "@ee/lib/journeys";
import { goalReady } from "@ee/types/experiment";
import type { JourneyInput, JourneyReEntry } from "@ee/types/journey";
import EventField from "./EventField";
import WholeInput from "./WholeInput";

const RE_ENTRY: { value: JourneyReEntry["mode"]; label: string }[] = [
  { value: "once", label: "Only once, ever" },
  { value: "after_exit", label: "Again after they leave" },
  { value: "after_days", label: "Again after some days" },
];

interface Props {
  projectId: string;
  draft: JourneyInput;
  locked: boolean;
  set: (patch: Partial<JourneyInput>) => void;
}

// A plain block in the side panel: a small heading, then its fields.
function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-[13px] font-semibold">{title}</h4>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// Fixed after launch: the notice that says so, above a section's fields.
export function LockedNote({ locked }: { locked: boolean }) {
  if (!locked) return null;
  return (
    <p className="rounded-md border border-sidebar-border bg-muted/50 p-3 text-[13px] text-muted-foreground">
      Fixed at launch so the results stay comparable. Duplicate the journey to
      change it.
    </p>
  );
}

export function EntrySection({ projectId, draft, locked, set }: Props) {
  const { entry } = draft;
  const setEntry = (patch: Partial<JourneyInput["entry"]>) =>
    set({ entry: { ...entry, ...patch } });
  return (
    <div className="space-y-5">
      <LockedNote locked={locked} />
      <fieldset disabled={locked} className="space-y-5">
        <Section
          title="Trigger"
          hint="An event they do, or a segment they join."
        >
          <div role="radiogroup" aria-label="Entry" className="grid gap-2">
            <OptionCard
              selected={entry.type === "event"}
              title="They do something"
              hint="An event or a screen, at once"
              icon={<Zap className="size-4" />}
              onSelect={() =>
                entry.type !== "event" &&
                setEntry({
                  type: "event",
                  event: { name: "", filters: [] },
                  segment_id: null,
                })
              }
            />
            <OptionCard
              selected={entry.type === "segment"}
              title="They join a segment"
              hint="Checked every 15 minutes"
              icon={<Users className="size-4" />}
              onSelect={() =>
                entry.type !== "segment" &&
                setEntry({ type: "segment", event: null, segment_id: null })
              }
            />
          </div>
          {entry.type === "event" ? (
            <EventField
              projectId={projectId}
              label="Entry event"
              value={entry.event}
              onChange={(event) => setEntry({ event })}
            />
          ) : (
            <SegmentSelect
              projectId={projectId}
              value={entry.segment_id ?? undefined}
              onChange={(id) => setEntry({ segment_id: id ?? null })}
            />
          )}
        </Section>

        <Section
          title="Who may enter"
          hint="Everyone, or only people in a segment."
        >
          <Choice
            label="Who may enter"
            value={entry.audience_segment_id === null ? "all" : "segment"}
            options={[
              { value: "all", label: "Everyone" },
              { value: "segment", label: "Only people in a segment" },
            ]}
            onChange={(v) =>
              setEntry({ audience_segment_id: v === "all" ? null : "" })
            }
          />
          {entry.audience_segment_id !== null && (
            <SegmentSelect
              projectId={projectId}
              value={entry.audience_segment_id || undefined}
              onChange={(id) => setEntry({ audience_segment_id: id ?? "" })}
            />
          )}
        </Section>

        <Section
          title="Entering again"
          hint="Nobody is in the journey twice at the same time."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Choice
              label="Re-entry"
              className="w-56"
              value={draft.re_entry.mode}
              options={RE_ENTRY}
              onChange={(mode) =>
                set({
                  re_entry: {
                    mode,
                    days:
                      mode === "after_days" ? (draft.re_entry.days ?? 7) : null,
                  },
                })
              }
            />
            {draft.re_entry.mode === "after_days" && (
              <>
                <WholeInput
                  aria-label="Days before entering again"
                  min={1}
                  className="w-20"
                  value={draft.re_entry.days}
                  onValue={(days) =>
                    set({ re_entry: { mode: "after_days", days } })
                  }
                />
                <span className="text-[13px] text-muted-foreground">days</span>
              </>
            )}
          </div>
        </Section>
      </fieldset>
    </div>
  );
}

export function GoalsSection({ projectId, draft, locked, set }: Props) {
  return (
    <div className="space-y-5">
      <LockedNote locked={locked} />
      <p className="text-[13px] text-muted-foreground">
        Reaching a goal takes someone out of the journey from any step and
        counts them as converted. The report measures the first goal against the
        control group.
      </p>
      <fieldset disabled={locked} className="space-y-5">
        {draft.goals.map((goal, i) => (
          <Section
            key={i}
            title={draft.goals.length > 1 ? `Goal ${i + 1}` : "Goal"}
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-muted-foreground"
                onClick={() =>
                  set({ goals: draft.goals.filter((_, j) => j !== i) })
                }
              >
                <Trash2 className="size-3.5" />
                Remove
              </Button>
            }
          >
            <GoalField
              bare
              projectId={projectId}
              withWindow={false}
              value={goalReady(goal) || goal.purchase ? goal : null}
              onChange={(next) =>
                set({
                  goals: draft.goals.map((g, j) =>
                    j === i ? (next ?? { event: "", window_hours: 168 }) : g
                  ),
                })
              }
            />
          </Section>
        ))}
        {draft.goals.length < MAX_GOALS && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              set({
                goals: [...draft.goals, { event: "", window_hours: 168 }],
              })
            }
          >
            <Plus className="size-3.5" />
            {draft.goals.length ? "Add another goal" : "Add a goal"}
          </Button>
        )}
      </fieldset>
    </div>
  );
}

export function ControlGroupSection({
  projectId,
  draft,
  locked,
  set,
  projectControlGroup,
}: Props & { projectControlGroup: number }) {
  return (
    <fieldset disabled={locked} className="space-y-3">
      <ControlGroupField
        projectId={projectId}
        bare
        journey
        value={draft.control_group}
        locked={locked}
        onChange={(control_group) => set({ control_group })}
      />
      {(draft.control_group || projectControlGroup > 0) && (
        <SplitOverview
          controlGroup={draft.control_group}
          variants={0}
          projectControlGroup={projectControlGroup}
          labels={{ a: "In the journey" }}
        />
      )}
    </fieldset>
  );
}

// Start and end rows, shared with the in-app composer.
export function ScheduleSection({ draft, locked, set }: Props) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const start = toLocalInput(draft.start_at);
  const end = toLocalInput(draft.end_at);
  return (
    <fieldset disabled={locked} className="space-y-3">
      <StartEndRows
        start={start}
        end={end}
        onStart={(v) => set({ start_at: v ? fromLocalInput(v) : null })}
        onEnd={(v) => set({ end_at: v ? fromLocalInput(v) : null })}
      />
      <p className="text-xs text-muted-foreground">
        Times are in your time zone ({zone}). After the end nobody new enters;
        people inside finish.
      </p>
    </fieldset>
  );
}
