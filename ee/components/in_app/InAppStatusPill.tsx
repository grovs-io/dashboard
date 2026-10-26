"use client";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TONE_CLASSES, inAppStatusLabel, inAppStatusTone } from "@ee/lib/inApp";
import type { InAppStatus } from "@ee/types/inApp";

export default function InAppStatusPill({ status }: { status: InAppStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1", TONE_CLASSES[inAppStatusTone(status)])}
    >
      {status === "preparing" && (
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
      )}
      {inAppStatusLabel(status)}
    </Badge>
  );
}
