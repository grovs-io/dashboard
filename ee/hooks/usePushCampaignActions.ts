"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import {
  awaitingWinner,
  duplicateInput,
  hadUploadedImage,
  pushErrorText,
} from "@ee/lib/push";
import { pushCampaignQueryOptions } from "@ee/hooks/queries/usePushQueries";
import {
  useCancelPushCampaign,
  useCreatePushCampaign,
} from "@ee/hooks/mutations/usePushMutations";
import type { PushCampaign } from "@ee/types/push";

// Duplicate and cancel, shared by the campaign list and the report page.
export function usePushCampaignActions(
  projectId: string,
  onDuplicated: (draftId: string) => void
) {
  const queryClient = useQueryClient();
  const create = useCreatePushCampaign(projectId);
  const cancel = useCancelPushCampaign(projectId);
  const [toCancel, setToCancel] = useState<PushCampaign | null>(null);

  const duplicate = async (campaign: PushCampaign) => {
    try {
      // Slim list rows omit `recipients`; fetch the full record so the copy carries them.
      const source =
        campaign.audience.recipients !== undefined
          ? campaign
          : await queryClient.fetchQuery(
              pushCampaignQueryOptions(projectId, campaign.id)
            );
      const draft = await create.mutateAsync(duplicateInput(source));
      showSuccessNotification(
        hadUploadedImage(source)
          ? "Draft created. Its image was not copied — re-upload it."
          : "Draft created"
      );
      onDuplicated(draft.id);
    } catch (error) {
      showErrorNotification(
        pushErrorText(error, "Could not duplicate this campaign")
      );
    }
  };

  const cancelConfirm = {
    open: toCancel !== null,
    setOpen: (open: boolean) => {
      if (!open) setToCancel(null);
    },
    title:
      toCancel && awaitingWinner(toCancel)
        ? "Cancel the rest?"
        : "Cancel this campaign?",
    description:
      toCancel && awaitingWinner(toCancel)
        ? "The people waiting will not receive the push."
        : toCancel?.status === "sending"
          ? "Pushes already handed to Apple or Google will still go out."
          : "This stops the campaign from sending. It cannot be resumed.",
    confirmText:
      toCancel && awaitingWinner(toCancel)
        ? "Cancel the rest"
        : "Cancel campaign",
    cancelText: "Keep it",
    pendingText: "Cancelling...",
    onConfirm: async () => {
      if (!toCancel) return;
      try {
        await cancel.mutateAsync(toCancel.id);
        showSuccessNotification("Campaign cancelled");
      } catch (error) {
        showErrorNotification(
          pushErrorText(error, "Could not cancel the campaign")
        );
      }
    },
  };

  return { duplicate, requestCancel: setToCancel, cancelConfirm };
}
