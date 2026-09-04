"use client";

import { useCallback, useState, type ReactNode } from "react";
import ScaleUpDialog from "@/components/settings/ScaleUpDialog";
import { useCreateSubscriptionMutation } from "@/hooks/mutations/usePaymentsMutations";
import { useProjectSelection } from "@/context/useProjectSelection";
import { ApiError } from "@/lib/ApiError";
import { showErrorNotification } from "@/lib/Notifications";

/**
 * Encapsulates the in-app "Scale Up" upgrade popup — state, the subscription
 * mutation, and the redirect-to-checkout handler — so any surface can open it
 * with a single call. Mirrors the wiring in PlanSection / CustomDomainSetup.
 *
 * Usage:
 *   const { openScaleUp, scaleUpDialog } = useScaleUpDialog();
 *   // ...render {scaleUpDialog} once, call openScaleUp() from a button.
 */
export function useScaleUpDialog(): {
  openScaleUp: () => void;
  scaleUpDialog: ReactNode;
} {
  const { selectedInstance } = useProjectSelection();
  const createSubscriptionMutation = useCreateSubscriptionMutation(
    selectedInstance?.id
  );
  const [open, setOpen] = useState(false);

  const handleUpgrade = useCallback(async () => {
    try {
      const response = await createSubscriptionMutation.mutateAsync();
      window.location.href = response.data.url;
    } catch (err) {
      showErrorNotification(
        err instanceof ApiError
          ? err.message
          : "Something went wrong, please try again"
      );
    }
  }, [createSubscriptionMutation]);

  const scaleUpDialog = (
    <ScaleUpDialog
      open={open}
      onOpenChange={setOpen}
      handleUpgrade={handleUpgrade}
    />
  );

  return { openScaleUp: () => setOpen(true), scaleUpDialog };
}
