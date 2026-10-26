"use client";
import type { ReactNode } from "react";
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
  scheduleLabel,
  scheduleZone,
  type ScheduleValue,
} from "@ee/lib/pushComposer";
import { devicesWord, reachCount } from "@ee/lib/push";
import type { PushEstimate } from "@ee/types/push";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  audience: string;
  reach: PushEstimate | null;
  schedule: ScheduleValue;
  // "10% control group · 2 variants · 20% test share", when there is one.
  experiment?: string | null;
  pending: boolean;
  onConfirm: () => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{children}</dd>
    </div>
  );
}

export default function SendConfirmDialog({
  open,
  onOpenChange,
  title,
  audience,
  reach,
  schedule,
  experiment,
  pending,
  onConfirm,
}: Props) {
  const scheduled = schedule.mode === "schedule";
  const when = scheduled
    ? `${scheduleLabel(schedule)} ${
        schedule.localTime
          ? "in each user's local time"
          : scheduleZone(schedule)
      }`
    : "Now";
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="border-sidebar-border sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {scheduled ? "Schedule this campaign?" : "Send this campaign now?"}
          </DialogTitle>
          <DialogDescription>
            {scheduled
              ? "You can cancel it until it starts sending."
              : "Pushes start going out within a few seconds. A sent campaign cannot be edited."}
          </DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-sidebar-border rounded-lg border border-sidebar-border px-3">
          <Row label="Title">{title}</Row>
          <Row label="Audience">{audience}</Row>
          <Row label="Reach">
            {reach ? (
              <span className="tabular-nums">
                {reachCount(reach)?.toLocaleString() ?? "—"}{" "}
                {devicesWord(reachCount(reach))}
              </span>
            ) : (
              <span className="font-normal text-muted-foreground">
                Not estimated yet
              </span>
            )}
          </Row>
          <Row label="When">{when}</Row>
          {experiment && <Row label="Experiment">{experiment}</Row>}
        </dl>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Keep editing
          </Button>
          <Button disabled={pending} aria-busy={pending} onClick={onConfirm}>
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            {scheduled ? "Schedule" : "Send now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
