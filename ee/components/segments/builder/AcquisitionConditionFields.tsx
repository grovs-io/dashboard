"use client";
import { catalogueEntry, windowCapDays } from "@ee/lib/segments";
import { fieldLabel } from "@ee/lib/segmentLabels";
import type {
  AcquisitionCondition,
  SegmentCatalogue,
} from "@ee/types/segments";
import { Pick } from "./InlineControls";
import MultiValueInput from "./MultiValueInput";
import ValuePicker from "./ValuePicker";
import WindowPicker from "./WindowPicker";

interface Props {
  projectId: string;
  condition: AcquisitionCondition;
  catalogue: SegmentCatalogue;
  onChange: (condition: AcquisitionCondition) => void;
}

// The field-values API resolves link/campaign ids to names under the aliases "link" and "campaign".
const VALUE_FIELD: Record<string, string> = {
  link_id: "link",
  campaign_id: "campaign",
  tracking_source: "tracking_source",
  tracking_medium: "tracking_medium",
};

export default function AcquisitionConditionFields({
  projectId,
  condition,
  catalogue,
  onChange,
}: Props) {
  const entry = catalogueEntry(catalogue, "acquisition");
  const idFields = entry?.id_fields ?? ["link_id", "campaign_id"];
  const fields = [
    ...idFields,
    ...(entry?.string_fields ?? ["tracking_source", "tracking_medium"]),
  ] as AcquisitionCondition["field"][];
  const isId = idFields.includes(condition.field);
  const valueField = VALUE_FIELD[condition.field];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pick
        ariaLabel="Acquisition field"
        value={condition.field}
        onChange={(field) =>
          onChange({
            ...condition,
            field,
            op:
              condition.op === "contains" && idFields.includes(field)
                ? "is"
                : condition.op,
            value: [],
          })
        }
        options={fields.map((f) => ({
          value: f,
          label: fieldLabel(f).toLowerCase(),
        }))}
      />
      <Pick
        ariaLabel="Acquisition operator"
        value={condition.op}
        onChange={(op) => onChange({ ...condition, op })}
        options={[
          { value: "is", label: "is" },
          { value: "is_not", label: "is not" },
          ...(isId ? [] : [{ value: "contains" as const, label: "contains" }]),
        ]}
      />
      {valueField && condition.op !== "contains" ? (
        <ValuePicker
          projectId={projectId}
          field={valueField}
          values={condition.value.map(String)}
          onChange={(value) =>
            onChange({ ...condition, value: isId ? value.map(Number) : value })
          }
          ariaLabel="Acquisition values"
          maxValues={catalogue.limits.values}
          placeholder={`choose ${fieldLabel(condition.field).toLowerCase()}s…`}
        />
      ) : (
        <MultiValueInput
          ariaLabel="Acquisition values"
          values={condition.value.map(String)}
          onChange={(value) => onChange({ ...condition, value })}
          maxValues={catalogue.limits.values}
          maxBytes={catalogue.limits.value_bytes}
          placeholder="value, value…"
        />
      )}
      <WindowPicker
        optional
        value={condition.window}
        capDays={windowCapDays("acquisition", catalogue)}
        onChange={(window) => onChange({ ...condition, window })}
      />
    </div>
  );
}
