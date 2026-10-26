"use client";
import { useMemo } from "react";
import { useAnalyticsEventFieldsQuery } from "@/hooks/queries/useAnalyticsEventsQueries";
import { catalogueEntry } from "@ee/lib/segments";
import type { ProfileCondition, SegmentCatalogue } from "@ee/types/segments";
import { Pick, humanize } from "./InlineControls";
import ValuePicker from "./ValuePicker";

interface Props {
  projectId: string;
  condition: ProfileCondition;
  catalogue: SegmentCatalogue;
  onChange: (condition: ProfileCondition) => void;
}

export default function ProfileConditionFields({
  projectId,
  condition,
  catalogue,
  onChange,
}: Props) {
  const entry = catalogueEntry(catalogue, "profile");
  const prefix = entry?.property_prefix ?? "properties.";
  const key = condition.field.startsWith(prefix)
    ? condition.field.slice(prefix.length)
    : condition.field;
  const valueless = condition.op === "is_set" || condition.op === "is_not_set";
  const fields = useAnalyticsEventFieldsQuery(projectId);
  const keys = useMemo(() => {
    const seen = new Set<string>(entry?.property_keys ?? []);
    for (const f of fields.data?.fields ?? [])
      if (f.type === "user_attribute") seen.add(f.name.replace(/^user\./, ""));
    return [...seen].sort().map((k) => ({ value: k, label: k }));
  }, [entry?.property_keys, fields.data]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ValuePicker
        projectId={projectId}
        field="user"
        multiple={false}
        allowCustom
        staticOptions={keys}
        values={key ? [key] : []}
        onChange={(v) =>
          onChange({ ...condition, field: `${prefix}${v[0] ?? ""}`, value: [] })
        }
        ariaLabel="Profile property key"
        placeholder="choose a property…"
      />
      <Pick
        ariaLabel="Profile operator"
        value={condition.op}
        onChange={(op) =>
          onChange({
            ...condition,
            op,
            value:
              op === "is_set" || op === "is_not_set"
                ? undefined
                : (condition.value ?? []),
          })
        }
        options={(
          entry?.ops ?? ["is", "is_not", "contains", "is_set", "is_not_set"]
        ).map((op) => ({ value: op, label: humanize(op) }))}
      />
      {!valueless && (
        <ValuePicker
          projectId={projectId}
          field={key ? `user.${key}` : "user"}
          allowCustom
          values={condition.value ?? []}
          onChange={(value) => onChange({ ...condition, value })}
          ariaLabel="Profile values"
          maxValues={catalogue.limits.values}
          placeholder="choose values…"
        />
      )}
    </div>
  );
}
