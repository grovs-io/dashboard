"use client";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isNegative, negationAllowed } from "@ee/lib/segments";
import type {
  SegmentCatalogue,
  SegmentCondition,
  SegmentGroup,
} from "@ee/types/segments";
import AcquisitionConditionFields from "./AcquisitionConditionFields";
import { CONDITION_TYPES } from "./conditionTypes";
import DeviceConditionFields from "./DeviceConditionFields";
import EventConditionFields from "./EventConditionFields";
import FirstSeenConditionFields from "./FirstSeenConditionFields";
import IdentifierConditionFields from "./IdentifierConditionFields";
import ProfileConditionFields from "./ProfileConditionFields";
import PurchaseConditionFields from "./PurchaseConditionFields";

interface Props {
  projectId: string;
  condition: SegmentCondition;
  group: SegmentGroup;
  catalogue: SegmentCatalogue;
  hasIdentifierList: boolean;
  issues: string[];
  onChange: (condition: SegmentCondition) => void;
  onRemove: () => void;
  onAddPositive?: () => void;
}

export default function ConditionRow({
  projectId,
  condition,
  group,
  catalogue,
  hasIdentifierList,
  issues,
  onChange,
  onRemove,
  onAddPositive,
}: Props) {
  const meta = CONDITION_TYPES.find((t) => t.type === condition.type)!;
  const needsPositive =
    isNegative(condition) &&
    !negationAllowed({
      ...group,
      conditions: group.conditions.filter((c) => c !== condition),
    });
  let editor: React.ReactNode;
  switch (condition.type) {
    case "event":
      editor = (
        <EventConditionFields
          projectId={projectId}
          condition={condition}
          catalogue={catalogue}
          onChange={onChange}
        />
      );
      break;
    case "device":
      editor = (
        <DeviceConditionFields
          projectId={projectId}
          condition={condition}
          catalogue={catalogue}
          onChange={onChange}
        />
      );
      break;
    case "profile":
      editor = (
        <ProfileConditionFields
          projectId={projectId}
          condition={condition}
          catalogue={catalogue}
          onChange={onChange}
        />
      );
      break;
    case "first_seen":
      editor = (
        <FirstSeenConditionFields condition={condition} onChange={onChange} />
      );
      break;
    case "identifier":
      editor = (
        <IdentifierConditionFields
          condition={condition}
          catalogue={catalogue}
          hasIdentifierList={hasIdentifierList}
          onChange={onChange}
        />
      );
      break;
    case "acquisition":
      editor = (
        <AcquisitionConditionFields
          projectId={projectId}
          condition={condition}
          catalogue={catalogue}
          onChange={onChange}
        />
      );
      break;
    case "purchase":
      editor = (
        <PurchaseConditionFields
          projectId={projectId}
          condition={condition}
          catalogue={catalogue}
          onChange={onChange}
        />
      );
      break;
  }
  return (
    <div
      className="group/row flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40"
      data-testid="condition-row"
      aria-label={meta.label}
    >
      <span
        className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-md bg-accent text-primary"
        title={meta.label}
      >
        <meta.icon className="size-3.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{meta.label}</span>
          {editor}
        </div>
        {needsPositive && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            An exclusion needs a positive condition in the same group to exclude
            from, combined with ALL.
            {onAddPositive && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={onAddPositive}
              >
                Add “did any activity”
              </Button>
            )}
          </p>
        )}
        {issues.length > 0 && (
          <ul className="space-y-0.5 text-xs text-destructive" role="alert">
            {issues.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
        aria-label="Remove condition"
        title="Remove condition"
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
