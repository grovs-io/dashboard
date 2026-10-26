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
import { pushErrorText } from "@ee/lib/push";
import type { VariantKey } from "@ee/lib/inAppComposer";
import { useSendWinner } from "@ee/hooks/mutations/usePushMutations";
import type { PushCampaign } from "@ee/types/push";

// "Send variant B to the 3,120 people waiting?", shared by the banner and the Experiment card.
export default function SendWinnerDialog({
  projectId,
  campaign,
  variant,
  onClose,
}: {
  projectId: string;
  campaign: PushCampaign;
  // The variant being asked about; null keeps the dialog closed.
  variant: VariantKey | null;
  onClose: () => void;
}) {
  const sendWinner = useSendWinner(projectId);
  const send = async () => {
    if (!variant) return;
    try {
      await sendWinner.mutateAsync({ id: campaign.id, variant });
      showSuccessNotification("Sending to the rest");
      onClose();
    } catch (error) {
      showErrorNotification(
        pushErrorText(error, "Could not send to the rest.")
      );
    }
  };
  return (
    <Dialog open={variant !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Send variant {variant?.toUpperCase()} to the{" "}
            {(campaign.report.waiting ?? 0).toLocaleString()} people waiting?
          </DialogTitle>
          <DialogDescription>This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="secondary"
            disabled={sendWinner.isPending}
            onClick={onClose}
          >
            Not now
          </Button>
          <Button disabled={sendWinner.isPending} onClick={() => void send()}>
            {sendWinner.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Send to the rest
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
