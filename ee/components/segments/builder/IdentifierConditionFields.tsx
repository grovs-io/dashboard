"use client";
import { catalogueEntry } from "@ee/lib/segments";
import type { IdentifierCondition, SegmentCatalogue } from "@ee/types/segments";
import { Pick } from "./InlineControls";
import MultiValueInput from "./MultiValueInput";

interface Props {
  condition: IdentifierCondition;
  catalogue: SegmentCatalogue;
  hasIdentifierList: boolean;
  onChange: (condition: IdentifierCondition) => void;
}

const labels: Record<IdentifierCondition["op"], string> = {
  is_set: "is set",
  is_not_set: "is not set",
  is: "is",
  contains: "contains",
  in_list: "is in the uploaded list",
  not_in_list: "is not in the uploaded list",
};

export default function IdentifierConditionFields({
  condition,
  catalogue,
  hasIdentifierList,
  onChange,
}: Props) {
  const entry = catalogueEntry(catalogue, "identifier");
  const valuelessOps = entry?.valueless_ops ?? [
    "is_set",
    "is_not_set",
    "in_list",
    "not_in_list",
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pick
        ariaLabel="Identifier operator"
        value={condition.op}
        onChange={(op) =>
          onChange({
            ...condition,
            op,
            value: valuelessOps.includes(op)
              ? undefined
              : (condition.value ?? []),
          })
        }
        options={(
          entry?.ops ?? (Object.keys(labels) as IdentifierCondition["op"][])
        ).map((op) => ({
          value: op,
          label: labels[op],
          disabled:
            (op === "in_list" || op === "not_in_list") && !hasIdentifierList,
          hint:
            (op === "in_list" || op === "not_in_list") && !hasIdentifierList
              ? "Upload an identifier list on the segment page first"
              : undefined,
        }))}
      />
      {!valuelessOps.includes(condition.op) && (
        <MultiValueInput
          ariaLabel="Identifier values"
          values={condition.value ?? []}
          onChange={(value) => onChange({ ...condition, value })}
          maxValues={catalogue.limits.values}
          maxBytes={catalogue.limits.value_bytes}
          placeholder="identifier, identifier…"
        />
      )}
    </div>
  );
}
