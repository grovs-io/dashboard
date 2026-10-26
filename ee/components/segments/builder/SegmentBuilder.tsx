"use client";
import { Fragment } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BuilderAction } from "@ee/lib/segmentBuilderReducer";
import type { SegmentIssue } from "@ee/lib/segments";
import type { SegmentCatalogue, SegmentDefinition } from "@ee/types/segments";
import Connector from "./Connector";
import GroupBlock from "./GroupBlock";

interface Props {
  projectId: string;
  definition: SegmentDefinition;
  catalogue: SegmentCatalogue;
  hasIdentifierList: boolean;
  issues: SegmentIssue[];
  dispatch: (action: BuilderAction) => void;
}

export default function SegmentBuilder({
  projectId,
  definition,
  catalogue,
  hasIdentifierList,
  issues,
  dispatch,
}: Props) {
  const issuesFor = (path: string) =>
    issues.filter((i) => i.path === path).map((i) => i.message);
  const full = definition.groups.length >= catalogue.limits.groups;
  return (
    <div className="flex flex-col gap-2">
      {definition.groups.map((group, g) => (
        <Fragment key={g}>
          {g > 0 && (
            <Connector
              size="md"
              value={definition.operator}
              onChange={(operator) =>
                dispatch({ type: "setTopOperator", operator })
              }
              ariaLabel="Group combination"
            />
          )}
          <GroupBlock
            projectId={projectId}
            index={g}
            group={group}
            catalogue={catalogue}
            hasIdentifierList={hasIdentifierList}
            issuesFor={issuesFor}
            canRemove={definition.groups.length > 1}
            onOperator={(operator) =>
              dispatch({ type: "setGroupOperator", group: g, operator })
            }
            onAddCondition={(conditionType) =>
              dispatch({ type: "addCondition", group: g, conditionType })
            }
            onRemoveCondition={(index) =>
              dispatch({ type: "removeCondition", group: g, index })
            }
            onPatchCondition={(index, condition) =>
              dispatch({ type: "patchCondition", group: g, index, condition })
            }
            onRemove={() => dispatch({ type: "removeGroup", group: g })}
          />
        </Fragment>
      ))}
      {issuesFor("groups").map((m) => (
        <p key={m} className="text-xs text-destructive" role="alert">
          {m}
        </p>
      ))}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-sidebar-border" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-primary hover:text-primary"
          disabled={full}
          title={full ? `At most ${catalogue.limits.groups} groups` : undefined}
          onClick={() => dispatch({ type: "addGroup" })}
        >
          <Plus className="size-4" /> Add{" "}
          {definition.operator === "or" ? "an OR" : "an AND"} group
        </Button>
        <span className="h-px flex-1 bg-sidebar-border" />
      </div>
    </div>
  );
}
