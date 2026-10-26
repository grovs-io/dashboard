"use client";
import { useState } from "react";
import { Percent, Plus, Split, Trash2 } from "lucide-react";
import ActionConfirm from "@/components/common/action-confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import SegmentSelect from "@ee/components/audience/SegmentSelect";
import { Choice, Field } from "@/components/composer/fields";
import OptionCard from "@/components/composer/OptionCard";
import { KeyInput } from "@ee/components/in_app/composer/TriggerSection";
import { useInAppSuggestions } from "@ee/hooks/queries/useInAppSuggestions";
import {
  MAX_PATHS,
  createCondition,
  evenPaths,
  lostSteps,
  setSplitMode,
  updateStep,
} from "@ee/lib/journeys";
import type {
  AttributeOp,
  JourneyInput,
  SplitCondition,
  SplitStep,
} from "@ee/types/journey";
import EventField from "../EventField";
import WholeInput from "../WholeInput";

const KINDS: { value: SplitCondition["kind"]; label: string }[] = [
  { value: "event", label: "Did an event" },
  { value: "segment", label: "Is in a segment" },
  { value: "attribute", label: "Has an attribute" },
  { value: "platform", label: "Uses a platform" },
];

const OPS: { value: AttributeOp; label: string }[] = [
  { value: "eq", label: "is" },
  { value: "neq", label: "is not" },
  { value: "contains", label: "contains" },
  { value: "gt", label: "is more than" },
  { value: "lt", label: "is less than" },
  { value: "exists", label: "is set" },
  { value: "not_exists", label: "is not set" },
];

const PLATFORMS = [
  { value: "ios", label: "iOS" },
  { value: "android", label: "Android" },
  { value: "web", label: "Web" },
] as const;

function Condition({
  projectId,
  condition,
  onChange,
}: {
  projectId: string;
  condition: SplitCondition;
  onChange: (c: SplitCondition) => void;
}) {
  const suggestions = useInAppSuggestions(projectId);
  switch (condition.kind) {
    case "event":
      return (
        <div className="space-y-3">
          <EventField
            projectId={projectId}
            label="Split event"
            value={condition.event}
            onChange={(event) => onChange({ ...condition, event })}
          />
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            At least
            <WholeInput
              aria-label="At least"
              min={1}
              className="w-20"
              value={condition.min_count}
              onValue={(min_count) => onChange({ ...condition, min_count })}
            />
            times in the last
            <WholeInput
              aria-label="Days back"
              min={1}
              className="w-20"
              value={condition.days}
              onValue={(days) => onChange({ ...condition, days })}
            />
            days
          </div>
        </div>
      );
    case "segment":
      return (
        <SegmentSelect
          projectId={projectId}
          value={condition.segment_id ?? undefined}
          onChange={(id) => onChange({ ...condition, segment_id: id ?? null })}
        />
      );
    case "attribute":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <KeyInput
            label="Attribute"
            placeholder="Attribute"
            className="w-40"
            options={suggestions.userAttributes}
            value={condition.key}
            onChange={(key) => onChange({ ...condition, key })}
          />
          <Choice
            label="Attribute operator"
            className="w-36"
            value={condition.op}
            options={OPS}
            onChange={(op) =>
              onChange(
                op === "exists" || op === "not_exists"
                  ? { kind: "attribute", key: condition.key, op }
                  : { ...condition, op, value: condition.value ?? "" }
              )
            }
          />
          {condition.op !== "exists" && condition.op !== "not_exists" && (
            <Input
              aria-label="Attribute value"
              placeholder="Value"
              className="w-36"
              value={String(condition.value ?? "")}
              onChange={(e) =>
                onChange({ ...condition, value: e.target.value })
              }
            />
          )}
        </div>
      );
    case "platform":
      return (
        <div role="group" aria-label="Platforms" className="flex gap-2">
          {PLATFORMS.map((p) => {
            const on = condition.values.includes(p.value);
            return (
              <Button
                key={p.value}
                type="button"
                size="sm"
                variant="outline"
                aria-pressed={on}
                className={cn(on && "border-primary bg-accent text-primary")}
                onClick={() =>
                  onChange({
                    ...condition,
                    values: on
                      ? condition.values.filter((v) => v !== p.value)
                      : [...condition.values, p.value],
                  })
                }
              >
                {p.label}
              </Button>
            );
          })}
        </div>
      );
  }
}

export default function SplitPanel({
  projectId,
  draft,
  step,
  locked,
  onChange,
}: {
  projectId: string;
  draft: JourneyInput;
  step: SplitStep;
  locked: boolean;
  onChange: (step: SplitStep) => void;
}) {
  // A change that drops steps asks first, naming how many.
  const [asking, setAsking] = useState<{
    next: SplitStep;
    lost: number;
    title: string;
  } | null>(null);
  const change = (next: SplitStep, title: string) => {
    const lost = lostSteps(draft, updateStep(draft, next));
    if (lost > 0) setAsking({ next, lost, title });
    else onChange(next);
  };
  const total =
    step.mode === "percent"
      ? step.paths.reduce((sum, p) => sum + (p.percent || 0), 0)
      : 0;
  return (
    <div className="space-y-6">
      <fieldset
        disabled={locked}
        role="radiogroup"
        aria-label="Split by"
        className="grid gap-2"
      >
        <OptionCard
          selected={step.mode === "condition"}
          title="By a condition"
          hint="Yes and No paths"
          icon={<Split className="size-4" />}
          onSelect={() =>
            change(setSplitMode(step, "condition"), "Split by a condition?")
          }
        />
        <OptionCard
          selected={step.mode === "percent"}
          title="By percentage"
          hint="2 or 3 random paths"
          icon={<Percent className="size-4" />}
          onSelect={() =>
            change(setSplitMode(step, "percent"), "Split by percentage?")
          }
        />
      </fieldset>
      {step.mode === "condition" ? (
        <fieldset disabled={locked} className="space-y-3">
          <Field label="People take Yes when they">
            {() => (
              <Choice
                label="Condition"
                value={step.condition.kind}
                options={KINDS}
                onChange={(kind) =>
                  kind !== step.condition.kind &&
                  onChange({ ...step, condition: createCondition(kind) })
                }
              />
            )}
          </Field>
          <Condition
            projectId={projectId}
            condition={step.condition}
            onChange={(condition) => onChange({ ...step, condition })}
          />
        </fieldset>
      ) : (
        <div className="space-y-2">
          {step.paths.map((path, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-16 text-[13px]">Path {i + 1}</span>
              <WholeInput
                aria-label={`Path ${i + 1} percent`}
                min={locked ? 0 : 1}
                max={100}
                className="w-24"
                value={path.percent}
                onValue={(percent) =>
                  onChange({
                    ...step,
                    paths: step.paths.map((p, j) =>
                      j === i ? { ...p, percent } : p
                    ),
                  })
                }
              />
              <span className="text-[13px] text-muted-foreground">%</span>
              {!locked && step.paths.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove path ${i + 1}`}
                  onClick={() =>
                    change(
                      { ...step, paths: step.paths.filter((_, j) => j !== i) },
                      `Remove path ${i + 1}?`
                    )
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
          <p
            className={cn(
              "text-xs",
              total === 100 ? "text-muted-foreground" : "text-destructive"
            )}
          >
            Adds up to {total}%. People are placed at random, once.
          </p>
          {!locked && step.paths.length < MAX_PATHS && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...step,
                  paths: evenPaths([...step.paths, { percent: 0, next: null }]),
                })
              }
            >
              <Plus className="size-3.5" />
              Add a path
            </Button>
          )}
        </div>
      )}
      <ActionConfirm
        open={!!asking}
        setOpen={(open) => !open && setAsking(null)}
        title={asking?.title ?? ""}
        description={`This removes ${asking?.lost ?? 0} step${asking?.lost === 1 ? "" : "s"} on the path that goes. You can undo it.`}
        confirmText="Remove steps"
        cancelText="Keep them"
        onConfirm={() => {
          if (asking) onChange(asking.next);
          setAsking(null);
        }}
      />
    </div>
  );
}
