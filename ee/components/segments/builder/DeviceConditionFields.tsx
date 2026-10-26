"use client";
import { catalogueEntry, windowCapDays } from "@ee/lib/segments";
import { fieldLabel } from "@ee/lib/segmentLabels";
import type { DeviceCondition, SegmentCatalogue } from "@ee/types/segments";
import { Pick, Word, humanize } from "./InlineControls";
import MultiValueInput from "./MultiValueInput";
import ValuePicker from "./ValuePicker";
import WindowPicker from "./WindowPicker";

interface Props {
  projectId: string;
  condition: DeviceCondition;
  catalogue: SegmentCatalogue;
  onChange: (condition: DeviceCondition) => void;
}

const SEARCHABLE = new Set([
  "platform",
  "os",
  "os_version",
  "app_version",
  "device_model",
  "country",
  "city",
]);

export default function DeviceConditionFields({
  projectId,
  condition,
  catalogue,
  onChange,
}: Props) {
  const entry = catalogueEntry(catalogue, "device");
  const canUse = (entry?.modes ?? []).includes("used");
  const pickable =
    SEARCHABLE.has(condition.field) && condition.op !== "contains";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pick
        ariaLabel="Device field"
        value={condition.field}
        onChange={(field) => onChange({ ...condition, field, value: [] })}
        options={(entry?.fields ?? [condition.field]).map((f) => ({
          value: f,
          label: fieldLabel(f),
        }))}
      />
      <Pick
        ariaLabel="Device operator"
        value={condition.op}
        onChange={(op) => onChange({ ...condition, op })}
        options={(entry?.ops ?? ["is", "is_not", "contains"]).map((op) => ({
          value: op,
          label: humanize(op),
        }))}
      />
      {pickable ? (
        <ValuePicker
          projectId={projectId}
          field={condition.field}
          values={condition.value}
          onChange={(value) => onChange({ ...condition, value })}
          ariaLabel="Device values"
          maxValues={catalogue.limits.values}
          placeholder={`choose ${fieldLabel(condition.field).toLowerCase()}…`}
        />
      ) : (
        <MultiValueInput
          ariaLabel="Device values"
          values={condition.value}
          onChange={(value) => onChange({ ...condition, value })}
          maxValues={catalogue.limits.values}
          maxBytes={catalogue.limits.value_bytes}
          placeholder="value, value…"
        />
      )}
      <Word>on</Word>
      <Pick
        ariaLabel="Device mode"
        value={condition.mode}
        onChange={(mode) =>
          onChange({
            ...condition,
            mode,
            window:
              mode === "used"
                ? (condition.window ?? { last_days: 30 })
                : undefined,
          })
        }
        options={[
          { value: "current", label: "current device" },
          ...(canUse
            ? [{ value: "used" as const, label: "any device used" }]
            : []),
        ]}
      />
      {condition.mode === "used" ? (
        <WindowPicker
          value={condition.window}
          capDays={windowCapDays("device", catalogue)}
          onChange={(window) => onChange({ ...condition, window })}
        />
      ) : (
        entry && (
          <Word className="text-xs">
            (seen in the last {entry.current_window_days} days)
          </Word>
        )
      )}
    </div>
  );
}
