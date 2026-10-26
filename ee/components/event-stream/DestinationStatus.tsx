"use client";

import { cn } from "@/lib/utils";
import type { EventDestination } from "@ee/types/eventStream";
import { destinationStatus } from "@ee/lib/eventStream";

export default function DestinationStatus({
  destination,
}: {
  destination: EventDestination;
}) {
  const label = destinationStatus(destination);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        label === "Active"
          ? "bg-valid-green/10 text-valid-green"
          : label === "Retrying" || label === "Paused after failures"
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground"
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {label}
    </span>
  );
}
