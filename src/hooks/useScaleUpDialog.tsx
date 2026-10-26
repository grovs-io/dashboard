"use client";

import { useState, type ReactNode } from "react";
import ScaleUpDialog from "@/components/settings/ScaleUpDialog";

/**
 * Lets any surface open the in-app upgrade dialog with a single call.
 *
 * Usage:
 *   const { openScaleUp, scaleUpDialog } = useScaleUpDialog();
 *   // ...render {scaleUpDialog} once, call openScaleUp() from a button.
 */
export function useScaleUpDialog(): {
  openScaleUp: () => void;
  scaleUpDialog: ReactNode;
} {
  const [open, setOpen] = useState(false);

  const scaleUpDialog = <ScaleUpDialog open={open} onOpenChange={setOpen} />;

  return { openScaleUp: () => setOpen(true), scaleUpDialog };
}
