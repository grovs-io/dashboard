"use client";
import { Fragment } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  SegmentCatalogue,
  SegmentCondition,
  SegmentConditionType,
  SegmentGroup,
  SegmentOperator,
} from "@ee/types/segments";
import AddConditionMenu from "./AddConditionMenu";
import ConditionRow from "./ConditionRow";
import Connector from "./Connector";

interface Props {
  projectId: string;
  index: number;
  group: SegmentGroup;
  catalogue: SegmentCatalogue;
  hasIdentifierList: boolean;
  issuesFor: (path: string) => string[];
  canRemove: boolean;
  onOperator: (operator: SegmentOperator) => void;
  onAddCondition: (type: SegmentConditionType) => void;
  onRemoveCondition: (i: number) => void;
  onPatchCondition: (i: number, condition: SegmentCondition) => void;
  onRemove: () => void;
}

export default function GroupBlock({
  projectId,
  index,
  group,
  catalogue,
  hasIdentifierList,
  issuesFor,
  canRemove,
  onOperator,
  onAddCondition,
  onRemoveCondition,
  onPatchCondition,
  onRemove,
}: Props) {
  const path = `groups.${index}`;
  // An empty group already says so in its body; the validation message only matters for the save gate.
  const groupIssues = group.conditions.length === 0 ? [] : issuesFor(path);
  const full = group.conditions.length >= catalogue.limits.conditions_per_group;
  const addPositive = () => {
    if (group.operator !== "and") onOperator("and");
    onAddCondition("event");
  };
  return (
    <section
      className="rounded-lg border border-sidebar-border bg-background"
      aria-label={`Group ${index + 1}`}
    >
      {canRemove && (
        <div className="flex items-center justify-between border-b border-sidebar-border px-3 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Group {index + 1}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-muted-foreground"
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" /> Remove group
          </Button>
        </div>
      )}
      <div className="flex flex-col px-2 py-1">
        {group.conditions.length === 0 && (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            This group is empty. Add a condition to describe who belongs here.
          </p>
        )}
        {group.conditions.map((condition, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <Connector
                value={group.operator}
                onChange={onOperator}
                ariaLabel={`Group ${index + 1} connector`}
              />
            )}
            <ConditionRow
              projectId={projectId}
              condition={condition}
              group={group}
              catalogue={catalogue}
              hasIdentifierList={hasIdentifierList}
              issues={issuesFor(`${path}.conditions.${i}`)}
              onChange={(c) => onPatchCondition(i, c)}
              onRemove={() => onRemoveCondition(i)}
              onAddPositive={addPositive}
            />
          </Fragment>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-sidebar-border px-2 py-1.5">
        <AddConditionMenu
          catalogue={catalogue}
          disabled={full}
          disabledReason={`At most ${catalogue.limits.conditions_per_group} conditions per group`}
          onSelect={onAddCondition}
        />
        {groupIssues.length > 0 && (
          <p className="text-xs text-destructive" role="alert">
            {groupIssues.join(" · ")}
          </p>
        )}
      </div>
    </section>
  );
}
