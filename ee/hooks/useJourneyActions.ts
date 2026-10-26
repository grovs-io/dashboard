"use client";
import { useState } from "react";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import { journeyErrorText } from "@ee/lib/journeys";
import {
  useDeleteJourney,
  useDuplicateJourney,
  useJourneyStep,
} from "@ee/hooks/mutations/useJourneyMutations";
import type { JourneyAction, JourneyRow } from "@ee/types/journey";

const DONE: Record<JourneyAction, string> = {
  launch: "Journey launched",
  pause: "Journey paused",
  resume: "Journey resumed",
  end: "Journey ended",
};

// Shared by the list and the report page. Ending and deleting ask first.
export function useJourneyActions(
  projectId: string,
  onDuplicated: (draftId: string) => void,
  onDeleted?: () => void
) {
  const step = useJourneyStep(projectId);
  const copy = useDuplicateJourney(projectId);
  const remove = useDeleteJourney(projectId);
  const [asking, setAsking] = useState<{
    journey: JourneyRow;
    what: "end" | "delete";
  } | null>(null);

  const run = async (journey: JourneyRow, action: JourneyAction) => {
    try {
      await step.mutateAsync({ id: journey.id, action });
      showSuccessNotification(DONE[action]);
    } catch (error) {
      showErrorNotification(
        journeyErrorText(error, `Could not ${action} the journey`)
      );
    }
  };

  const duplicate = async (journey: JourneyRow) => {
    try {
      const draft = await copy.mutateAsync(journey.id);
      showSuccessNotification("Draft created");
      onDuplicated(draft.id);
    } catch (error) {
      showErrorNotification(
        journeyErrorText(error, "Could not duplicate this journey")
      );
    }
  };

  const ending = asking?.what === "end";
  const confirm = {
    open: asking !== null,
    setOpen: (open: boolean) => {
      if (!open) setAsking(null);
    },
    title: ending ? "End this journey?" : "Delete this draft?",
    description: ending
      ? "Nobody new enters; people already inside finish their path. An ended journey cannot start again, but it can be duplicated."
      : "The draft is removed for good.",
    confirmText: ending ? "End journey" : "Delete",
    cancelText: "Keep it",
    onConfirm: async () => {
      if (!asking) return;
      if (asking.what === "end") return run(asking.journey, "end");
      try {
        await remove.mutateAsync(asking.journey.id);
        showSuccessNotification("Draft deleted");
        onDeleted?.();
      } catch (error) {
        showErrorNotification(
          journeyErrorText(error, "Could not delete the draft")
        );
      }
    },
  };

  return {
    duplicate,
    step: (journey: JourneyRow, action: JourneyAction) =>
      action === "end"
        ? setAsking({ journey, what: "end" })
        : void run(journey, action),
    requestDelete: (journey: JourneyRow) =>
      setAsking({ journey, what: "delete" }),
    confirm,
  };
}
