"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dismissNewBoard, isNewBoard } from "./newBoardHint";

/** One-time "your board is ready" hint on a board just copied from a built-in. */
export function NewBoardBanner({ dashboardId }: { dashboardId: number }) {
  // Boards render only after the client fetch, so reading storage here can't mismatch SSR.
  const [show, setShow] = useState(() => isNewBoard(dashboardId));
  if (!show) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-background px-4 py-2.5 text-sm"
    >
      <Check className="size-4 shrink-0 text-valid-green dark:text-emerald-400" />
      <p className="flex-1 text-muted-foreground">
        <span className="font-semibold text-foreground">
          Your board is ready.
        </span>{" "}
        Drag widgets to rearrange, use ⋯ on a widget to edit or remove it, or
        add new ones.
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={() => {
          dismissNewBoard(dashboardId);
          setShow(false);
        }}
      >
        Got it
      </Button>
    </div>
  );
}
