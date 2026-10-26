"use client";
import { Users } from "lucide-react";
import ControlGroupField from "@ee/components/experiments/ControlGroupField";
import GoalField from "@ee/components/experiments/GoalField";
import SplitOverview from "@ee/components/experiments/SplitOverview";
import type { InAppDraft } from "@ee/lib/inAppComposer";
import { Card } from "./LimitsSection";

interface Props {
  projectId: string;
  draft: InAppDraft;
  set: (patch: Partial<InAppDraft>) => void;
  // The control group is fixed at launch.
  launched: boolean;
  projectControlGroup: number;
}

export default function ExperimentSection({
  projectId,
  draft,
  set,
  launched,
  projectControlGroup,
}: Props) {
  return (
    <div className="space-y-4">
      <GoalField
        projectId={projectId}
        value={draft.conversion}
        onChange={(conversion) => set({ conversion })}
      />
      <ControlGroupField
        projectId={projectId}
        value={draft.controlGroup}
        locked={launched}
        onChange={(controlGroup) => set({ controlGroup })}
      />
      <Card
        icon={<Users className="size-3.5" />}
        title="Who gets what"
        hint="How the audience is split between the groups."
      >
        <SplitOverview
          controlGroup={draft.controlGroup}
          variants={draft.variants.length}
          projectControlGroup={projectControlGroup}
        />
      </Card>
    </div>
  );
}
