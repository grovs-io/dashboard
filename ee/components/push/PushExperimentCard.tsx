"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  PUSH_EXPERIMENT_CARD_ID,
  awaitingWinner,
  pushErrorText,
} from "@ee/lib/push";
import type { VariantKey } from "@ee/lib/inAppComposer";
import { usePushExperimentQuery } from "@ee/hooks/queries/usePushQueries";
import ExperimentCard from "@ee/components/experiments/ExperimentCard";
import type { PushCampaign } from "@ee/types/push";
import SendWinnerDialog from "./SendWinnerDialog";

interface Props {
  projectId: string;
  campaign: PushCampaign;
}

// The experiment of a push campaign, with "Send to the rest" while people wait for the winner.
export default function PushExperimentCard({ projectId, campaign }: Props) {
  const query = usePushExperimentQuery(
    projectId,
    campaign.id,
    true,
    awaitingWinner(campaign) || campaign.status === "sending"
  );
  const [asking, setAsking] = useState<VariantKey | null>(null);
  const waiting = campaign.report.waiting;
  // Until a winner is picked, by hand or by the timer, the owner can send one.
  const canSend = campaign.status === "sent" && waiting > 0 && !campaign.winner;
  // After send_winner the campaign is sending again, to the people who waited.
  const sending = campaign.status === "sending" && !!campaign.winner;

  return (
    <div id={PUSH_EXPERIMENT_CARD_ID}>
      <ExperimentCard
        query={query}
        errorText={(error) =>
          pushErrorText(error, "Could not load the experiment.")
        }
        clickedLabel="Opened"
        editable={false}
        audience={
          campaign.report.targeted + (campaign.report.held ?? 0) || null
        }
        action={
          canSend
            ? (variant) => (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Send variant ${variant.toUpperCase()} to the rest`}
                  onClick={() => setAsking(variant)}
                >
                  Send to the rest
                </Button>
              )
            : sending
              ? (variant) =>
                  variant === campaign.winner ? (
                    <span className="text-xs text-muted-foreground">
                      Sending to the rest…
                    </span>
                  ) : null
              : undefined
        }
      >
        <SendWinnerDialog
          projectId={projectId}
          campaign={campaign}
          variant={asking}
          onClose={() => setAsking(null)}
        />
      </ExperimentCard>
    </div>
  );
}
