"use client";
import { Split, Users } from "lucide-react";
import ControlGroupField from "@ee/components/experiments/ControlGroupField";
import GoalField from "@ee/components/experiments/GoalField";
import SplitOverview from "@ee/components/experiments/SplitOverview";
import { Choice } from "@/components/composer/fields";
import { Card } from "@ee/components/in_app/composer/LimitsSection";
import { FieldError } from "@/components/common/FieldError";
import {
  LOCAL_TIME_SHARE,
  TEST_SHARES,
  type ExperimentValue,
} from "@ee/lib/pushComposer";
import {
  WINNER_AFTER_MINUTES,
  type WinnerAfter,
  type WinnerBy,
} from "@ee/types/push";

const SHARES = [
  { value: "0", label: "Everyone at once" },
  ...TEST_SHARES.map((n) => ({ value: String(n), label: `${n}%` })),
];
const AFTER: Record<WinnerAfter, string> = {
  30: "30 minutes",
  60: "1 hour",
  120: "2 hours",
  360: "6 hours",
  720: "12 hours",
  1440: "24 hours",
};
const JUDGES: { value: WinnerBy; label: string }[] = [
  { value: "opens", label: "Opens" },
  { value: "conversions", label: "Conversions" },
];
const PICKERS = [
  { value: "0", label: "Myself, from the report" },
  ...WINNER_AFTER_MINUTES.map((n) => ({
    value: String(n),
    label: `Automatically after ${AFTER[n]}`,
  })),
];

interface Props {
  projectId: string;
  value: ExperimentValue;
  onChange: (value: ExperimentValue) => void;
  projectControlGroup: number;
  // The reach estimate, when there is one: the split and the test share then say it in people.
  audience: number | null;
  // Local-time delivery and a test share do not go together.
  localTime?: boolean;
}

// Mirrors Experiments::Winner.pick.
const AUTO_WINNER =
  "The variant with the best rate goes to the rest; a tie goes to the earlier variant. If any variant has fewer than 100 people by then, A goes.";

export default function ExperimentSection({
  projectId,
  value,
  onChange,
  projectControlGroup,
  audience,
  localTime = false,
}: Props) {
  const testCount =
    value.testShare !== null && audience
      ? Math.round((audience * value.testShare) / 100)
      : null;
  const testPeople =
    testCount !== null
      ? ` (about ${testCount.toLocaleString()} ${testCount === 1 ? "person" : "people"})`
      : "";
  return (
    <div className="space-y-4">
      <GoalField
        projectId={projectId}
        value={value.conversion}
        onChange={(conversion) => onChange({ ...value, conversion })}
      />
      <ControlGroupField
        projectId={projectId}
        value={value.controlGroup}
        onChange={(controlGroup) => onChange({ ...value, controlGroup })}
      />
      <Card
        icon={<Users className="size-3.5" />}
        title="Who gets what"
        hint="How the audience is split between the groups."
      >
        <SplitOverview
          controlGroup={value.controlGroup}
          variants={value.variants.length}
          projectControlGroup={projectControlGroup}
          audience={audience}
        />
      </Card>

      {value.variants.length > 0 && (
        <Card
          icon={<Split className="size-3.5" />}
          title="Test share"
          hint="Send the variants to a part of the audience first, then the winner to the rest."
        >
          <Choice
            label="Test share"
            className="w-44"
            disabled={localTime}
            value={String(value.testShare ?? 0)}
            options={SHARES}
            onChange={(next) =>
              onChange({
                ...value,
                testShare: Number(next) === 0 ? null : Number(next),
              })
            }
          />
          <p className="text-xs text-muted-foreground">
            {localTime
              ? "Not available with local-time delivery."
              : value.testShare === null
                ? "Everyone gets a variant at once."
                : `${value.testShare}%${testPeople} get the variants now; the rest wait until you pick the winner.`}
          </p>
          {localTime && value.testShare !== null && (
            <FieldError message={LOCAL_TIME_SHARE} />
          )}
          {value.testShare !== null && (
            <div className="space-y-2 border-t border-sidebar-border pt-3.5">
              <p className="text-[13px] font-medium">Pick the winner</p>
              <div className="flex flex-wrap items-center gap-2">
                <Choice
                  label="Pick the winner"
                  className="w-56"
                  value={String(value.winnerAfter ?? 0)}
                  options={PICKERS}
                  onChange={(next) =>
                    onChange({
                      ...value,
                      winnerAfter:
                        Number(next) === 0
                          ? null
                          : (Number(next) as WinnerAfter),
                    })
                  }
                />
                {value.winnerAfter !== null && (
                  <Choice
                    label="Judge by"
                    className="w-40"
                    value={value.winnerBy}
                    options={JUDGES.map((j) => ({
                      ...j,
                      disabled: j.value === "conversions" && !value.conversion,
                    }))}
                    onChange={(winnerBy) => onChange({ ...value, winnerBy })}
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {value.winnerAfter === null
                  ? "You send the winner to the rest from the report."
                  : !value.conversion
                    ? `${AUTO_WINNER} Set a goal first to judge by conversions.`
                    : AUTO_WINNER}
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
