"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { canEdit, inAppErrorText } from "@ee/lib/inApp";
import type { VariantKey } from "@ee/lib/inAppComposer";
import { useInAppExperimentQuery } from "@ee/hooks/queries/useInAppQueries";
import ExperimentCard from "@ee/components/experiments/ExperimentCard";
import type { InAppCampaign } from "@ee/types/inApp";
import UseForEveryoneDialog from "./UseForEveryoneDialog";

export {
  ExperimentSkeleton,
  experimentSentence,
} from "@ee/components/experiments/ExperimentCard";

interface Props {
  projectId: string;
  campaign: InAppCampaign;
  period: { from: string; to: string };
  audience?: number | null;
  // Opens the composer on the draft made from a variant, as Duplicate does.
  onDuplicated: (draftId: string) => void;
}

// The experiment of an in-app campaign, with "Use for everyone" on each variant.
export default function InAppExperimentCard({
  projectId,
  campaign,
  period,
  audience,
  onDuplicated,
}: Props) {
  const query = useInAppExperimentQuery(projectId, campaign.id, period, true);
  const [asking, setAsking] = useState<VariantKey | null>(null);
  // A journey step is changed from its journey only.
  const mayEdit = campaign.audience.type !== "journey" && canEdit(campaign);

  return (
    <ExperimentCard
      query={query}
      errorText={(error) =>
        inAppErrorText(error, "Could not load the experiment.")
      }
      clickedLabel="Clicked"
      editable={mayEdit}
      audience={audience}
      action={
        mayEdit
          ? (variant) => (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Use variant ${variant.toUpperCase()} for everyone`}
                onClick={() => setAsking(variant)}
              >
                Use for everyone
              </Button>
            )
          : undefined
      }
    >
      <UseForEveryoneDialog
        projectId={projectId}
        campaign={campaign}
        variant={asking}
        onClose={() => setAsking(null)}
        onDuplicated={onDuplicated}
      />
    </ExperimentCard>
  );
}
