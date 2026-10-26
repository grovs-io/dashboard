"use client";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TONE_CLASSES, statusLabel, statusTone } from "@ee/lib/push";
import type { PushStatus } from "@ee/types/push";

// `waiting`: sent to the test share, the rest still waiting for a winner.
export default function PushStatusPill({
  status,
  waiting = false,
}: {
  status: PushStatus;
  waiting?: boolean;
}) {
  const tone = waiting ? "blue" : statusTone(status);
  const spinning = status === "evaluating" || status === "sending";
  return (
    <Badge variant="outline" className={cn("gap-1", TONE_CLASSES[tone])}>
      {spinning && (
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
      )}
      {waiting ? "Waiting for the winner" : statusLabel(status)}
    </Badge>
  );
}
