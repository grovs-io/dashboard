"use client";
import { describeCondition } from "@ee/lib/segments";
import type { SegmentDefinition } from "@ee/types/segments";

export default function DefinitionSummary({
  definition,
}: {
  definition: SegmentDefinition;
}) {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-muted-foreground">
        Users who match {definition.operator === "or" ? "any" : "all"} of these
        groups
      </p>
      {definition.groups.map((group, g) => (
        <div
          key={g}
          className="rounded-md border border-sidebar-border bg-background p-3"
        >
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Group {g + 1} · {group.operator === "and" ? "all" : "any"}{" "}
            conditions
          </p>
          <ul className="space-y-1">
            {group.conditions.map((c, i) => (
              <li key={i}>{describeCondition(c)}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
