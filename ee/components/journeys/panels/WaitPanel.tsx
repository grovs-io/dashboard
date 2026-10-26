"use client";
import { useState } from "react";
import { Choice, Field } from "@/components/composer/fields";
import ActionConfirm from "@/components/common/action-confirm";
import {
  MAX_WAIT,
  lostSteps,
  setUntil,
  stepLabel,
  stepsAbove,
  updateStep,
} from "@ee/lib/journeys";
import type { JourneyInput, WaitStep, WaitUntil } from "@ee/types/journey";
import EventField from "../EventField";
import WholeInput from "../WholeInput";

const UNITS = [
  { value: "1", label: "minutes" },
  { value: "60", label: "hours" },
  { value: "1440", label: "days" },
] as const;
type Unit = (typeof UNITS)[number]["value"];

const unitOf = (minutes: number): Unit =>
  minutes % 1440 === 0 ? "1440" : minutes % 60 === 0 ? "60" : "1";

type Kind = "none" | WaitUntil["kind"];

export default function WaitPanel({
  projectId,
  draft,
  step,
  locked,
  onChange,
}: {
  projectId: string;
  draft: JourneyInput;
  step: WaitStep;
  locked: boolean;
  onChange: (step: WaitStep) => void;
}) {
  const [unit, setUnit] = useState<Unit>(unitOf(step.minutes));
  const factor = Number(unit);
  const pushes = stepsAbove(draft, step.id, "push");
  const messages = stepsAbove(draft, step.id, "in_app");
  const kind: Kind = step.until?.kind ?? "none";
  const [asking, setAsking] = useState(0);
  // Steps only the Time ran out path leads to go with it.
  const dropped = (next: WaitStep) => lostSteps(draft, updateStep(draft, next));
  const until = (next: Kind, confirmed = false) => {
    if (next === kind) return;
    if (next === "none" && !confirmed) {
      const lost = dropped(setUntil(step, null));
      if (lost > 0) return setAsking(lost);
    }
    const made: WaitUntil | null =
      next === "event"
        ? { kind: "event", event: { name: "", filters: [] } }
        : next === "opened"
          ? { kind: "opened", step: pushes[0] ?? "" }
          : next === "clicked"
            ? { kind: "clicked", step: messages[0] ?? "" }
            : null;
    onChange(setUntil(step, made));
  };

  return (
    <div className="space-y-6">
      <Field label="Wait for" hint="From 5 minutes to 30 days.">
        {(id) => (
          <div className="flex gap-2">
            <WholeInput
              id={id}
              min={1}
              className="w-28"
              value={step.minutes / factor}
              onValue={(n) =>
                onChange({ ...step, minutes: Math.min(n * factor, MAX_WAIT) })
              }
            />
            <Choice
              label="Unit"
              className="w-32"
              value={unit}
              options={UNITS}
              onChange={(next) => {
                setUnit(next);
                onChange({
                  ...step,
                  minutes: Math.min(
                    Math.max(1, Math.round(step.minutes / factor)) *
                      Number(next),
                    MAX_WAIT
                  ),
                });
              }}
            />
          </div>
        )}
      </Field>
      <fieldset disabled={locked} className="space-y-3">
        <Field
          label="Move on early if they…"
          hint={
            kind === "none"
              ? "Everyone waits the whole time, then moves on."
              : "If they do, they take the Did it path right away; otherwise Time ran out after the wait."
          }
        >
          {() => (
            <Choice
              label="Until"
              value={kind}
              options={[
                { value: "none", label: "Nothing" },
                { value: "event", label: "Do an event" },
                {
                  value: "opened",
                  label: "Open the push above",
                  disabled: pushes.length === 0,
                },
                {
                  value: "clicked",
                  label: "Click the in-app above",
                  disabled: messages.length === 0,
                },
              ]}
              onChange={until}
            />
          )}
        </Field>
        {step.until?.kind === "event" && (
          <EventField
            projectId={projectId}
            label="Wait for event"
            value={step.until.event}
            onChange={(event) =>
              onChange({ ...step, until: { kind: "event", event } })
            }
          />
        )}
        {(step.until?.kind === "opened" || step.until?.kind === "clicked") && (
          <Choice
            label="Which step"
            value={step.until.step}
            options={(step.until.kind === "opened" ? pushes : messages).map(
              (id) => ({ value: id, label: stepLabel(draft, id) })
            )}
            onChange={(id) =>
              step.until &&
              step.until.kind !== "event" &&
              onChange({ ...step, until: { ...step.until, step: id } })
            }
          />
        )}
      </fieldset>
      <ActionConfirm
        open={asking > 0}
        setOpen={(open) => !open && setAsking(0)}
        title="Remove the Time ran out path?"
        description={`This removes the Time ran out path and its ${asking} step${asking === 1 ? "" : "s"}.`}
        confirmText="Remove path"
        cancelText="Keep it"
        onConfirm={() => until("none", true)}
      />
    </div>
  );
}
