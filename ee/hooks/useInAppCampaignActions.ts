"use client";
import { useState } from "react";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import { inAppErrorText } from "@ee/lib/inApp";
import {
  useDeleteInAppCampaign,
  useDuplicateInAppCampaign,
  useInAppStep,
} from "@ee/hooks/mutations/useInAppMutations";
import type { InAppCampaign, InAppStep } from "@ee/types/inApp";

const DONE: Record<InAppStep, string> = {
  launch: "Campaign launched",
  pause: "Campaign paused",
  resume: "Campaign resumed",
  end: "Campaign ended",
};

// Shared by the campaign list and the report page. Ending and deleting ask first.
export function useInAppCampaignActions(
  projectId: string,
  onDuplicated: (draftId: string) => void,
  onDeleted?: () => void
) {
  const step = useInAppStep(projectId);
  const duplicateCampaign = useDuplicateInAppCampaign(projectId);
  const remove = useDeleteInAppCampaign(projectId);
  const [asking, setAsking] = useState<{
    campaign: InAppCampaign;
    what: "end" | "delete";
  } | null>(null);

  const run = async (campaign: InAppCampaign, which: InAppStep) => {
    try {
      await step.mutateAsync({ id: campaign.id, step: which });
      showSuccessNotification(DONE[which]);
    } catch (error) {
      showErrorNotification(
        inAppErrorText(error, `Could not ${which} the campaign`)
      );
    }
  };

  const duplicate = async (campaign: InAppCampaign) => {
    try {
      const draft = await duplicateCampaign.mutateAsync({ id: campaign.id });
      showSuccessNotification("Draft created");
      onDuplicated(draft.id);
    } catch (error) {
      showErrorNotification(
        inAppErrorText(error, "Could not duplicate this campaign")
      );
    }
  };

  const ending = asking?.what === "end";
  const confirm = {
    open: asking !== null,
    setOpen: (open: boolean) => {
      if (!open) setAsking(null);
    },
    title: ending ? "End this campaign?" : "Delete this draft?",
    description: ending
      ? "Devices stop showing it at their next sync. An ended campaign cannot be started again, but it can be duplicated."
      : "The draft is removed for good.",
    confirmText: ending ? "End campaign" : "Delete",
    cancelText: "Keep it",
    onConfirm: async () => {
      if (!asking) return;
      if (asking.what === "end") return run(asking.campaign, "end");
      try {
        await remove.mutateAsync(asking.campaign.id);
        showSuccessNotification("Draft deleted");
        onDeleted?.();
      } catch (error) {
        showErrorNotification(
          inAppErrorText(error, "Could not delete the draft")
        );
      }
    },
  };

  return {
    duplicate,
    step: (campaign: InAppCampaign, which: InAppStep) =>
      which === "end"
        ? setAsking({ campaign, what: "end" })
        : void run(campaign, which),
    requestDelete: (campaign: InAppCampaign) =>
      setAsking({ campaign, what: "delete" }),
    confirm,
  };
}
