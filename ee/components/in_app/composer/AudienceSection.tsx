"use client";
import { Plus, Trash2, UserSearch, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SegmentSelect from "@ee/components/audience/SegmentSelect";
import { MAX_CONDITIONS, type InAppDraft } from "@ee/lib/inAppComposer";
import type { InAppSuggestions } from "@ee/hooks/queries/useInAppSuggestions";
import type { InAppCondition, InAppConditionType } from "@ee/types/inApp";
import { Choice } from "@/components/composer/fields";
import OptionCard from "@/components/composer/OptionCard";
import { KeyInput, VALUE_OPS, ValueInput, withOp } from "./TriggerSection";

const TYPES: { value: InAppConditionType; label: string }[] = [
  { value: "platform", label: "Platform" },
  { value: "app_version", label: "App version" },
  { value: "os_version", label: "OS version" },
  { value: "language", label: "Language" },
  { value: "user_attribute", label: "User attribute" },
  { value: "event_count", label: "Times an event happened" },
  { value: "first_seen", label: "First seen" },
];

const IS = [
  { value: "eq", label: "is" },
  { value: "neq", label: "is not" },
];
const ORDER = [
  ...IS,
  { value: "gt", label: "is above" },
  { value: "lt", label: "is below" },
];
const SEEN = [
  { value: "within_days", label: "in the last" },
  { value: "before", label: "before" },
  { value: "after", label: "after" },
];
const PLATFORMS = [
  { value: "ios", label: "iOS" },
  { value: "android", label: "Android" },
  { value: "web", label: "Web" },
];

export function blankCondition(type: InAppConditionType): InAppCondition {
  switch (type) {
    case "platform":
      return { type, op: "eq", value: "ios" };
    case "language":
      return { type, op: "eq", value: "en" };
    case "event_count":
      return { type, op: "gt", name: "", value: 0 };
    case "user_attribute":
      return { type, op: "eq", key: "", value: "" };
    case "first_seen":
      return { type, op: "within_days", value: 7 };
    default:
      return { type, op: "gt", value: "" };
  }
}

const text = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

// Always three cells, so every row shares the same columns.
function ConditionFields({
  index,
  condition,
  attributes,
  onChange,
}: {
  index: number;
  condition: InAppCondition;
  attributes: string[];
  onChange: (condition: InAppCondition) => void;
}) {
  const n = index + 1;
  const op = (options: { value: string; label: string }[]) => (
    <Choice
      label={`Condition ${n} operator`}
      value={condition.op}
      options={options}
      onChange={(next) => onChange({ ...condition, op: next })}
    />
  );
  const value = (placeholder: string, numeric = false) => (
    <Input
      aria-label={`Condition ${n} value`}
      placeholder={placeholder}
      type={numeric ? "number" : "text"}
      value={text(condition.value)}
      onChange={(e) =>
        onChange({
          ...condition,
          // Left empty while it is being typed, and whole: the server takes no fraction of a time or a day.
          value: !numeric
            ? e.target.value
            : e.target.value === ""
              ? ""
              : Math.trunc(Number(e.target.value)),
        })
      }
    />
  );
  const none = null;

  switch (condition.type) {
    case "platform":
      return (
        <>
          {op(IS)}
          <Choice
            label={`Condition ${n} value`}
            value={text(condition.value) || "ios"}
            options={PLATFORMS}
            onChange={(next) => onChange({ ...condition, value: next })}
          />
          {none}
        </>
      );
    case "language":
      return (
        <>
          {op(IS)}
          {value("Two letters, such as en")}
          {none}
        </>
      );
    case "app_version":
    case "os_version":
      return (
        <>
          {op(ORDER)}
          {value("Such as 2.1.0")}
          {none}
        </>
      );
    case "event_count":
      return (
        <>
          <Input
            aria-label={`Condition ${n} event name`}
            placeholder="Event name"
            value={condition.name ?? ""}
            onChange={(e) => onChange({ ...condition, name: e.target.value })}
          />
          {op(ORDER)}
          {value("Times", true)}
        </>
      );
    case "user_attribute":
      return (
        <>
          <KeyInput
            label={`Condition ${n} attribute`}
            placeholder="Attribute"
            options={attributes}
            value={condition.key ?? ""}
            onChange={(key) => onChange({ ...condition, key })}
          />
          <Choice
            label={`Condition ${n} operator`}
            value={condition.op}
            options={VALUE_OPS}
            onChange={(next) => onChange(withOp(condition, next))}
          />
          <ValueInput
            label={`Condition ${n} value`}
            op={condition.op}
            value={condition.value}
            onChange={(next) => onChange({ ...condition, value: next })}
          />
        </>
      );
    case "first_seen":
      return (
        <>
          <Choice
            label={`Condition ${n} operator`}
            value={condition.op}
            options={SEEN}
            onChange={(next) =>
              onChange({
                ...condition,
                op: next,
                value:
                  next === "within_days"
                    ? 7
                    : new Date().toISOString().slice(0, 10),
              })
            }
          />
          {condition.op === "within_days" ? (
            <div className="flex items-center gap-2">
              {value("Days", true)}
              <span className="text-xs text-muted-foreground">days</span>
            </div>
          ) : (
            <Input
              aria-label={`Condition ${n} value`}
              type="date"
              value={text(condition.value).slice(0, 10)}
              onChange={(e) =>
                onChange({ ...condition, value: e.target.value })
              }
            />
          )}
          {none}
        </>
      );
  }
}

interface Props {
  projectId: string;
  draft: InAppDraft;
  set: (patch: Partial<InAppDraft>) => void;
  // The audience is frozen at launch.
  launched: boolean;
  suggestions: InAppSuggestions;
}

export default function AudienceSection({
  projectId,
  draft,
  set,
  launched,
  suggestions,
}: Props) {
  const update = (index: number, next: InAppCondition) =>
    set({
      conditions: draft.conditions.map((c, i) => (i === index ? next : c)),
    });
  const segment = draft.audience.type === "segment";

  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <p className="text-[13px] font-medium">Who can see it</p>
        <div
          role="radiogroup"
          aria-label="Audience"
          className="grid gap-2 sm:grid-cols-2"
        >
          <OptionCard
            selected={!segment}
            disabled={launched}
            title="Everyone"
            hint="Every visitor of this project"
            icon={<Users className="size-4" />}
            onSelect={() => !launched && set({ audience: { type: "all" } })}
          />
          <OptionCard
            selected={segment}
            disabled={launched}
            title="People in a segment"
            hint="Eligible within about an hour of entering it"
            icon={<UserSearch className="size-4" />}
            onSelect={() =>
              !launched && !segment && set({ audience: { type: "segment" } })
            }
          />
        </div>
        {draft.audience.type === "segment" && !launched && (
          <SegmentSelect
            projectId={projectId}
            value={draft.audience.segmentId}
            onChange={(segmentId) =>
              set({ audience: { type: "segment", segmentId } })
            }
          />
        )}
        {launched && (
          <p className="text-xs text-muted-foreground">
            The audience was fixed at launch. To change it, end this campaign
            and launch a copy.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[13px] font-medium">
            Conditions on the device (optional)
          </p>
          <p className="text-xs text-muted-foreground">
            All must hold at the moment of the trigger. The device checks them
            by itself, so they cost no time.
          </p>
        </div>
        {draft.conditions.length > 0 && (
          <div className="space-y-2">
            {draft.conditions.map((condition, index) => (
              <div
                key={index}
                className="flex w-fit max-w-full flex-wrap items-center gap-2 sm:flex-nowrap [&>*:not(:last-child)]:w-full sm:[&>*:not(:last-child)]:w-40 sm:[&>*:not(:last-child)]:shrink-0"
              >
                <Choice
                  label={`Condition ${index + 1} type`}
                  value={condition.type}
                  options={TYPES}
                  onChange={(type) => update(index, blankCondition(type))}
                />
                <ConditionFields
                  index={index}
                  condition={condition}
                  attributes={suggestions.userAttributes}
                  onChange={(next) => update(index, next)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove condition ${index + 1}`}
                  onClick={() =>
                    set({
                      conditions: draft.conditions.filter(
                        (_, i) => i !== index
                      ),
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {draft.conditions.length < MAX_CONDITIONS && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              set({
                conditions: [...draft.conditions, blankCondition("platform")],
              })
            }
          >
            <Plus className="size-3.5" />
            Add a condition
          </Button>
        )}
      </div>
    </div>
  );
}
