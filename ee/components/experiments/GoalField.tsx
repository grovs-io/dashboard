"use client";
import { useState } from "react";
import { Target } from "lucide-react";
import ValuePicker from "@ee/components/segments/builder/ValuePicker";
import { Choice } from "@/components/composer/fields";
import { Card } from "@ee/components/in_app/composer/LimitsSection";
import { windowLabel } from "@ee/lib/inAppComposer";
import {
  CONVERSION_WINDOWS,
  MESSAGE_EVENTS,
  PURCHASE_WINDOWS,
  SYSTEM_EVENTS,
  SYSTEM_EVENT_INFO,
  conversionOf,
  goalKind,
  goalName,
  goalReady,
  purchaseGoal,
  type Conversion,
  type ConversionWindow,
  type GoalKind,
} from "@ee/types/experiment";

const windowOptions = (hours: readonly ConversionWindow[]) =>
  hours.map((h) => ({ value: String(h), label: `within ${windowLabel(h)}` }));
const WINDOWS = windowOptions(CONVERSION_WINDOWS);
const PURCHASE_WINDOW_OPTIONS = windowOptions(PURCHASE_WINDOWS);
const KINDS: { value: GoalKind; label: string }[] = [
  { value: "system", label: "A built-in event" },
  { value: "event", label: "A custom event" },
  { value: "screen", label: "A screen" },
  { value: "purchase", label: "A purchase" },
];
const HINTS: Record<GoalKind, string> = {
  event:
    "The custom events your app tracks. Seeing or answering the message never counts.",
  screen: "The screens your app reports.",
  system: "Recorded by the SDK in every app.",
  purchase: "Store purchases, renewals included.",
};
const BUILT_IN = SYSTEM_EVENTS.map((v) => ({
  value: v,
  label: SYSTEM_EVENT_INFO[v].label,
}));
const PRODUCT_SCOPES = [
  { value: "any", label: "Any product" },
  { value: "some", label: "Only these products" },
] as const;
const MESSAGE_EVENT_NAMES = [...MESSAGE_EVENTS];

// The goal of an experiment, for in-app and push alike: an event or a screen, then a window.
export default function GoalField({
  projectId,
  value,
  onChange,
  hint = "Count a conversion when someone does this after seeing the message.",
  withWindow = true,
  title = "Goal",
  bare,
}: {
  projectId: string;
  value: Conversion | null;
  onChange: (value: Conversion | null) => void;
  hint?: string;
  // Journeys count a goal any time while someone is in the journey.
  withWindow?: boolean;
  title?: string;
  // Without its card, inside a panel that already has a heading.
  bare?: boolean;
}) {
  // Switching the kind clears the name; without a goal the kind is only remembered here.
  const [chosen, setChosen] = useState<GoalKind>(
    value ? goalKind(value) : "event"
  );
  const kind = value ? goalKind(value) : chosen;
  const name = value ? goalName(value) : "";
  const hours = value?.window_hours ?? (withWindow ? 72 : 168);
  const ready = !!value && goalReady(value);
  const products = value?.products ?? [];
  // An empty list is "only these products" with none chosen yet, which blocks saving.
  const someProducts = value?.products !== undefined;
  const picking = kind === "purchase" && someProducts;
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Choice
          label="Count as a conversion"
          className="w-40"
          value={kind}
          options={KINDS}
          onChange={(next) => {
            if (next === kind) return;
            setChosen(next);
            onChange(next === "purchase" ? purchaseGoal([], hours) : null);
          }}
        />
        {kind === "purchase" ? (
          <Choice
            label="Which products"
            className="w-48"
            value={someProducts ? "some" : "any"}
            options={PRODUCT_SCOPES}
            onChange={(next) =>
              onChange(
                next === "some"
                  ? { purchase: true, products: [], window_hours: hours }
                  : purchaseGoal([], hours)
              )
            }
          />
        ) : kind === "system" ? (
          <Choice
            label="Goal built-in event"
            className="w-44"
            value={name || "none"}
            options={[
              { value: "none", label: "Choose one", disabled: true },
              ...BUILT_IN,
            ]}
            onChange={(next) => onChange(conversionOf(kind, next, hours))}
          />
        ) : (
          <ValuePicker
            key={kind}
            projectId={projectId}
            field={kind === "screen" ? "screen_name" : "event_name"}
            multiple={false}
            allowCustom
            exclude={kind === "event" ? MESSAGE_EVENT_NAMES : undefined}
            ariaLabel={kind === "screen" ? "Goal screen" : "Goal event"}
            placeholder={
              kind === "screen" ? "Choose a screen" : "Choose an event"
            }
            values={name ? [name] : []}
            onChange={([next]) =>
              onChange(next ? conversionOf(kind, next, hours) : null)
            }
          />
        )}
        {withWindow && value && (ready || kind === "purchase") && (
          <Choice
            label="Conversion window"
            className="w-40"
            value={String(hours)}
            options={kind === "purchase" ? PURCHASE_WINDOW_OPTIONS : WINDOWS}
            onChange={(next) =>
              onChange({
                ...value,
                window_hours: Number(next) as ConversionWindow,
              })
            }
          />
        )}
      </div>
      {picking && (
        <ValuePicker
          projectId={projectId}
          field="purchase.product_id"
          allowCustom
          maxValues={20}
          ariaLabel="Goal products"
          placeholder="Choose products"
          addLabel="Add product"
          values={products}
          onChange={(next) =>
            onChange({ purchase: true, products: next, window_hours: hours })
          }
        />
      )}
      <p className="text-xs text-muted-foreground">
        {picking && products.length === 0
          ? "Choose at least one product, or count any product."
          : ready
            ? HINTS[kind]
            : withWindow
              ? "No goal. Views and clicks are still compared between the variants."
              : "Choose what counts as reaching the goal."}
      </p>
    </>
  );
  return bare ? (
    <div className="min-w-0 space-y-3">{body}</div>
  ) : (
    <Card icon={<Target className="size-3.5" />} title={title} hint={hint}>
      {body}
    </Card>
  );
}
