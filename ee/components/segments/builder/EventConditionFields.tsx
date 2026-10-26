"use client";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { catalogueEntry, windowCapDays } from "@ee/lib/segments";
import { fieldLabel } from "@ee/lib/segmentLabels";
import type {
  EventCondition,
  EventFilter,
  SegmentCatalogue,
} from "@ee/types/segments";
import EventTargetPicker from "./EventTargetPicker";
import { Pick, Word, humanize } from "./InlineControls";
import ValuePicker from "./ValuePicker";
import WindowPicker from "./WindowPicker";

interface Props {
  projectId: string;
  condition: EventCondition;
  catalogue: SegmentCatalogue;
  onChange: (condition: EventCondition) => void;
}

export default function EventConditionFields({
  projectId,
  condition,
  catalogue,
  onChange,
}: Props) {
  const entry = catalogueEntry(catalogue, "event");
  const prefix = entry?.property_prefix ?? "properties.";
  const filters = condition.filters ?? [];
  const setFilter = (i: number, patch: Partial<EventFilter>) =>
    onChange({
      ...condition,
      filters: filters.map((f, j) => (j === i ? { ...f, ...patch } : f)),
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {entry?.negatable !== false && (
          <Pick
            ariaLabel="Did or did not"
            value={condition.negate ? "not" : "did"}
            onChange={(v) =>
              onChange({ ...condition, negate: v === "not" ? true : undefined })
            }
            options={[
              { value: "did", label: "did" },
              { value: "not", label: "did not" },
            ]}
          />
        )}
        <EventTargetPicker
          projectId={projectId}
          condition={condition}
          eventTypes={entry?.event_types ?? []}
          onChange={(patch) => onChange({ ...condition, ...patch })}
        />
        <Word>at least</Word>
        <Input
          type="number"
          aria-label="Minimum count"
          className="h-8 w-16"
          min={1}
          value={condition.count ?? 1}
          onChange={(e) =>
            onChange({
              ...condition,
              count: Math.max(1, Number(e.target.value) || 1),
            })
          }
        />
        <Word>{(condition.count ?? 1) === 1 ? "time" : "times"}</Word>
        <WindowPicker
          value={condition.window}
          capDays={windowCapDays("event", catalogue)}
          onChange={(window) => onChange({ ...condition, window })}
        />
        {filters.length < catalogue.limits.filters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            onClick={() =>
              onChange({
                ...condition,
                filters: [
                  ...filters,
                  {
                    field: entry?.filter_columns[0] ?? "",
                    op: "is",
                    value: "",
                  },
                ],
              })
            }
          >
            <Plus className="size-3.5" /> where
          </Button>
        )}
      </div>
      {filters.map((f, i) => {
        const isProperty = f.field.startsWith(prefix);
        return (
          <div key={i} className="flex flex-wrap items-center gap-2 pl-6">
            <Word>{i === 0 ? "where" : "and"}</Word>
            <Pick
              ariaLabel={`Filter ${i + 1} field`}
              value={isProperty ? "property" : f.field}
              placeholder="field"
              onChange={(v) =>
                setFilter(i, {
                  field: v === "property" ? prefix : v,
                  value: "",
                })
              }
              options={[
                ...(entry?.filter_columns ?? []).map((c) => ({
                  value: c,
                  label: fieldLabel(c),
                })),
                { value: "property", label: "Event property…" },
              ]}
            />
            {isProperty && (
              <Input
                aria-label={`Filter ${i + 1} property key`}
                className="h-8 w-36"
                placeholder="property key"
                value={f.field.slice(prefix.length)}
                onChange={(e) =>
                  setFilter(i, { field: `${prefix}${e.target.value.trim()}` })
                }
              />
            )}
            <Pick
              ariaLabel={`Filter ${i + 1} operator`}
              value={f.op}
              onChange={(v) => setFilter(i, { op: v })}
              options={(entry?.filter_ops ?? ["is", "is_not", "contains"]).map(
                (op) => ({ value: op, label: humanize(op) })
              )}
            />
            {isProperty || f.op === "contains" ? (
              <Input
                aria-label={`Filter ${i + 1} value`}
                className="h-8 w-40"
                placeholder="value"
                value={f.value}
                onChange={(e) => setFilter(i, { value: e.target.value })}
              />
            ) : (
              <ValuePicker
                projectId={projectId}
                field={f.field}
                multiple={false}
                values={f.value ? [f.value] : []}
                onChange={(v) => setFilter(i, { value: v[0] ?? "" })}
                ariaLabel={`Filter ${i + 1} value`}
                placeholder="choose a value…"
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              aria-label={`Remove filter ${i + 1}`}
              onClick={() =>
                onChange({
                  ...condition,
                  filters: filters.filter((_, j) => j !== i),
                })
              }
            >
              <X className="size-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
