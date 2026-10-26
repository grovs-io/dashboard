"use client";
import { useId } from "react";
import { Monitor, Plus, Power, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ValuePicker from "@ee/components/segments/builder/ValuePicker";
import {
  DELAYS,
  delayLabel,
  MAX_FILTERS,
  MAX_TRIGGERS,
  type InAppDraft,
} from "@ee/lib/inAppComposer";
import type { InAppSuggestions } from "@ee/hooks/queries/useInAppSuggestions";
import type { InAppFilter, InAppTrigger, InAppValueOp } from "@ee/types/inApp";
import { Choice } from "@/components/composer/fields";
import OptionCard from "@/components/composer/OptionCard";

const TYPES = [
  {
    value: "app_open",
    title: "The app is opened",
    hint: "Once per visit",
    icon: <Power className="size-4" />,
  },
  {
    value: "screen_view",
    title: "A screen is viewed",
    hint: "One screen, or any",
    icon: <Monitor className="size-4" />,
  },
  {
    value: "event",
    title: "An event is tracked",
    hint: "Such as cart_viewed",
    icon: <Zap className="size-4" />,
  },
] as const;
const TYPE_OPTIONS = TYPES.map((t) => ({ value: t.value, label: t.title }));

export const VALUE_OPS: { value: InAppValueOp; label: string }[] = [
  { value: "eq", label: "is" },
  { value: "neq", label: "is not" },
  { value: "gt", label: "is more than" },
  { value: "lt", label: "is less than" },
  { value: "between", label: "is between" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "is_set", label: "is set" },
  { value: "is_not_set", label: "is not set" },
];

const blank = (type: InAppTrigger["type"]): InAppTrigger =>
  type === "event" ? { type, name: "" } : { type };

const numberOf = (value: unknown, fallback: number) =>
  typeof value === "number" ? value : fallback;

export function withOp<T extends { op: string; value?: unknown }>(
  rule: T,
  op: string
): T {
  if (op === "is_set" || op === "is_not_set") {
    const { value: _dropped, ...rest } = rule;
    return { ...rest, op } as T;
  }
  if (op === "between")
    return {
      ...rule,
      op,
      value: Array.isArray(rule.value) ? rule.value : [0, 1],
    };
  return {
    ...rule,
    op,
    value:
      Array.isArray(rule.value) || rule.value === undefined ? "" : rule.value,
  };
}

// A text input that offers the keys the project has recorded, and still takes any other.
export function KeyInput({
  label,
  placeholder,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const list = useId();
  return (
    <>
      <Input
        aria-label={label}
        placeholder={placeholder}
        list={list}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={list}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}

// Shared by event filters and user attribute conditions: the same operators, the same inputs.
export function ValueInput({
  label,
  op,
  value,
  onChange,
}: {
  label: string;
  op: string;
  value: unknown;
  onChange: (value: string | [number, number]) => void;
}) {
  if (op === "is_set" || op === "is_not_set") return null;
  if (op === "between") {
    const pair: [number, number] = Array.isArray(value)
      ? [numberOf(value[0], 0), numberOf(value[1], 1)]
      : [0, 1];
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <Input
          aria-label={`${label} from`}
          type="number"
          value={pair[0]}
          onChange={(e) => onChange([Number(e.target.value), pair[1]])}
        />
        <span className="text-xs text-muted-foreground">and</span>
        <Input
          aria-label={`${label} to`}
          type="number"
          value={pair[1]}
          onChange={(e) => onChange([pair[0], Number(e.target.value)])}
        />
      </div>
    );
  }
  return (
    <Input
      aria-label={label}
      placeholder="Value"
      value={
        typeof value === "string" || typeof value === "number" ? value : ""
      }
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// Every rule row has the same columns, so the bins line up down the right edge.
export const RULE_ROW =
  "flex w-fit max-w-full flex-wrap items-center gap-2 sm:flex-nowrap [&>*:not(:last-child)]:w-full sm:[&>*:not(:last-child)]:w-40 sm:[&>*:not(:last-child)]:shrink-0";

export function Filters({
  filters,
  properties,
  onChange,
}: {
  filters: InAppFilter[];
  properties: string[];
  onChange: (filters: InAppFilter[]) => void;
}) {
  const update = (index: number, next: InAppFilter) =>
    onChange(filters.map((f, i) => (i === index ? next : f)));
  return (
    <div className="space-y-2">
      {filters.length > 0 && (
        <p className="text-xs font-medium text-muted-foreground">
          Only when the event has
        </p>
      )}
      {filters.map((filter, index) => (
        <div key={index} className={RULE_ROW}>
          <KeyInput
            label={`Filter ${index + 1} property`}
            placeholder="Property"
            options={properties}
            value={filter.field}
            onChange={(field) => update(index, { ...filter, field })}
          />
          <Choice
            label={`Filter ${index + 1} operator`}
            value={filter.op}
            options={VALUE_OPS}
            onChange={(op) => update(index, withOp(filter, op))}
          />
          <ValueInput
            label={`Filter ${index + 1} value`}
            op={filter.op}
            value={filter.value}
            onChange={(value) => update(index, { ...filter, value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove filter ${index + 1}`}
            onClick={() => onChange(filters.filter((_, i) => i !== index))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      {filters.length < MAX_FILTERS && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 text-primary"
          onClick={() =>
            onChange([...filters, { field: "", op: "eq", value: "" }])
          }
        >
          <Plus className="size-3.5" />
          Add a filter on the event properties
        </Button>
      )}
    </div>
  );
}

export default function TriggerSection({
  projectId,
  draft,
  set,
  suggestions,
  delay = true,
  compact,
}: {
  projectId: string;
  draft: InAppDraft;
  set: (patch: Partial<InAppDraft>) => void;
  suggestions: InAppSuggestions;
  delay?: boolean;
  // A dropdown instead of cards, for narrow side panels.
  compact?: boolean;
}) {
  const update = (index: number, next: InAppTrigger) =>
    set({ triggers: draft.triggers.map((t, i) => (i === index ? next : t)) });

  return (
    <div className="space-y-5">
      {draft.triggers.map((trigger, index) => (
        <div
          key={index}
          className="space-y-3 rounded-lg border border-sidebar-border p-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              {index === 0 ? "Show it when" : "Or when"}
            </p>
            {draft.triggers.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Remove trigger ${index + 1}`}
                onClick={() =>
                  set({
                    triggers: draft.triggers.filter((_, i) => i !== index),
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
          {compact ? (
            <Choice
              label={`Trigger ${index + 1}`}
              value={trigger.type}
              options={TYPE_OPTIONS}
              onChange={(next) =>
                next !== trigger.type && update(index, blank(next))
              }
            />
          ) : (
            <div
              role="radiogroup"
              aria-label={`Trigger ${index + 1}`}
              className="grid gap-2 sm:grid-cols-3"
            >
              {TYPES.map((type) => (
                <OptionCard
                  key={type.value}
                  selected={trigger.type === type.value}
                  title={type.title}
                  hint={type.hint}
                  icon={type.icon}
                  onSelect={() =>
                    trigger.type !== type.value &&
                    update(index, blank(type.value))
                  }
                />
              ))}
            </div>
          )}
          {trigger.type === "screen_view" && (
            <div className="space-y-1.5">
              <p className="text-[13px] font-medium">Which screen</p>
              <div className="flex flex-wrap items-center gap-2">
                <ValuePicker
                  projectId={projectId}
                  field="screen_name"
                  multiple={false}
                  allowCustom
                  ariaLabel={`Trigger ${index + 1} screen name`}
                  placeholder="Any screen"
                  values={trigger.name ? [trigger.name] : []}
                  onChange={([name]) =>
                    update(
                      index,
                      name ? { ...trigger, name } : { type: "screen_view" }
                    )
                  }
                />
                {trigger.name && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => update(index, { type: "screen_view" })}
                  >
                    Any screen
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                The list holds the screens your app has reported. Capital
                letters do not matter.
              </p>
            </div>
          )}
          {trigger.type === "event" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-[13px] font-medium">Which event</p>
                <ValuePicker
                  projectId={projectId}
                  field="event_name"
                  multiple={false}
                  allowCustom
                  ariaLabel={`Trigger ${index + 1} event name`}
                  placeholder="Choose an event"
                  values={trigger.name ? [trigger.name] : []}
                  onChange={([name]) =>
                    update(index, { ...trigger, name: name ?? "" })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  The list holds the events your app has tracked. The name must
                  match exactly.
                </p>
              </div>
              <Filters
                filters={trigger.filters ?? []}
                properties={suggestions.eventProperties}
                onChange={(filters) => update(index, { ...trigger, filters })}
              />
            </div>
          )}
        </div>
      ))}
      {draft.triggers.length < MAX_TRIGGERS && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            set({ triggers: [...draft.triggers, { type: "event", name: "" }] })
          }
        >
          <Plus className="size-3.5" />
          Add another trigger
        </Button>
      )}
      {delay && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sidebar-border p-3">
          <div>
            <p className="text-[13px] font-medium">When to show it</p>
            <p className="text-xs text-muted-foreground">
              A short wait lets the screen settle first. After the wait the
              message is checked again, and shown only if it still applies.
            </p>
          </div>
          <Choice
            label="Delay"
            className="w-48"
            value={String(draft.delaySeconds)}
            options={[...new Set([...DELAYS, draft.delaySeconds])]
              .sort((a, b) => a - b)
              .map((seconds) => ({
                value: String(seconds),
                label: delayLabel(seconds),
              }))}
            onChange={(value) => set({ delaySeconds: Number(value) })}
          />
        </div>
      )}
    </div>
  );
}
