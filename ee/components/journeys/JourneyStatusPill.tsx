"use client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  TONE_CLASSES,
  journeyStatusLabel,
  journeyStatusTone,
} from "@ee/lib/journeys";
import type { JourneyStatus } from "@ee/types/journey";

export default function JourneyStatusPill({
  status,
}: {
  status: JourneyStatus;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(TONE_CLASSES[journeyStatusTone(status)])}
    >
      {journeyStatusLabel(status)}
    </Badge>
  );
}
