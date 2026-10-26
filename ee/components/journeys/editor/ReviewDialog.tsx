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
import { journeyName, launchSummary } from "@ee/lib/journeys";
import type { JourneyInput } from "@ee/types/journey";
import Checklist, { type CheckItem } from "./Checklist";

// A short confirm, like the in-app launch: what will happen, in one paragraph.
export default function ReviewDialog({
  open,
  onOpenChange,
  draft,
  items,
  segmentName,
  projectControlGroup,
  busy,
  onGo,
  onLaunch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: JourneyInput;
  items: CheckItem[];
  segmentName: (id: string) => string | null;
  projectControlGroup: number;
  busy: boolean;
  onGo: (item: CheckItem) => void;
  onLaunch: () => void;
}) {
  // The editor keeps Launch off while anything is missing; this covers a race.
  const ready = items.length === 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Launch “{journeyName(draft)}”?</DialogTitle>
          <DialogDescription>
            {ready
              ? launchSummary(draft, segmentName, projectControlGroup)
              : "Fix these first:"}
          </DialogDescription>
        </DialogHeader>
        {!ready && <Checklist items={items} onGo={onGo} />}
        <p className="text-xs text-muted-foreground">
          After launch only messages and timings can change.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not yet
          </Button>
          <Button disabled={!ready || busy} onClick={onLaunch}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Launch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
