"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import { canEnd, inAppErrorText } from "@ee/lib/inApp";
import type { VariantKey } from "@ee/lib/inAppComposer";
import {
  useDuplicateInAppCampaign,
  useInAppStep,
} from "@ee/hooks/mutations/useInAppMutations";
import type { InAppCampaign } from "@ee/types/inApp";

// "Use variant B for everyone?": a draft from that variant, and optionally the end of this campaign.
export default function UseForEveryoneDialog({
  projectId,
  campaign,
  variant,
  onClose,
  onDuplicated,
}: {
  projectId: string;
  campaign: InAppCampaign;
  // The variant being asked about; null keeps the dialog closed.
  variant: VariantKey | null;
  onClose: () => void;
  onDuplicated: (draftId: string) => void;
}) {
  const duplicate = useDuplicateInAppCampaign(projectId);
  const step = useInAppStep(projectId);
  const busy = duplicate.isPending || step.isPending;

  const rollOut = async () => {
    if (!variant) return;
    try {
      // "a" too: the copy must drop the experiment, which a plain duplicate keeps.
      const draft = await duplicate.mutateAsync({ id: campaign.id, variant });
      showSuccessNotification("Draft created");
      onClose();
      onDuplicated(draft.id);
    } catch (error) {
      showErrorNotification(
        inAppErrorText(error, "Could not create the draft")
      );
    }
  };
  const end = async () => {
    try {
      await step.mutateAsync({ id: campaign.id, step: "end" });
      showSuccessNotification("Campaign ended");
      onClose();
    } catch (error) {
      showErrorNotification(
        inAppErrorText(error, "Could not end the campaign")
      );
    }
  };

  return (
    <Dialog open={variant !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Use variant {variant?.toUpperCase()} for everyone?
          </DialogTitle>
          <DialogDescription>
            A new draft with this content and no experiment will be created. You
            can end this campaign afterwards.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Not now
          </Button>
          {canEnd(campaign) && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void end()}
            >
              {step.isPending && <Loader2 className="size-4 animate-spin" />}
              End this campaign
            </Button>
          )}
          <Button disabled={busy} onClick={() => void rollOut()}>
            {duplicate.isPending && <Loader2 className="size-4 animate-spin" />}
            Create the draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
