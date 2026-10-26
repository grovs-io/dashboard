"use client";

import { useState } from "react";
import { ChevronDown, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { eventStreamApi } from "@ee/api/event-stream/eventStreamService";
import type { EventDestination } from "@ee/types/eventStream";
import type { StreamActions } from "@ee/hooks/mutations/useEventStreamActions";
import { streamDate, streamLag } from "@ee/lib/eventStream";
import { EVENT_TYPE_LABELS } from "./eventTypeLabels";
import DestinationStatus from "./DestinationStatus";
import { StreamError } from "./StreamUi";

export default function DestinationDetails({
  destination: d,
  projectId,
  admin,
  actions,
  onEdit,
  onReplay,
  onDelete,
  onClose,
}: {
  destination: EventDestination;
  projectId: string;
  admin: boolean;
  actions: StreamActions;
  onEdit: () => void;
  onReplay: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [testResult, setTestResult] = useState("");
  const [testing, setTesting] = useState(false);
  const test = async () => {
    setTestResult("");
    setTesting(true);
    const result = await actions.run(() =>
      eventStreamApi.action(projectId, d.id, "test")
    );
    if (result) setTestResult(result.message ?? "Test event delivered");
    setTesting(false);
  };
  const connection =
    d.kind === "webhook"
      ? [["Endpoint", d.settings.url ?? "—"]]
      : [
          ["Bucket", d.settings.bucket ?? "—"],
          ["Region", d.settings.region ?? "—"],
        ];
  const diagnostics = [
    ["Last attempt", streamDate(d.last_attempt_at)],
    [
      "Failing since",
      d.failing_since ? streamDate(d.failing_since) : "No failures",
    ],
    [
      "Next attempt after",
      d.backoff_until ? streamDate(d.backoff_until) : "No backoff",
    ],
    ["Analytics bookmark", streamDate(d.events_cursor_at)],
    ["Purchases bookmark", streamDate(d.purchases_cursor_at)],
    ...(d.kind === "webhook"
      ? [
          ["Batch size", String(d.batch_size)],
          ["Concurrency", String(d.concurrency)],
        ]
      : []),
    ["Credentials", d.has_credentials ? "Stored securely" : "None"],
    ...(d.kind === "s3"
      ? [
          ["Object prefix", d.settings.prefix || "None"],
          ["Storage endpoint", d.settings.endpoint || "Default"],
          [
            "Path-style addressing",
            d.settings.force_path_style ? "Enabled" : "Disabled",
          ],
        ]
      : []),
  ];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !actions.pending) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[90dvh] max-w-[calc(100vw_-_2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        showCloseButton={!actions.pending}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="shrink-0 px-6 pb-5 pt-6 text-left">
          <DialogTitle className="break-words pr-6 text-lg">
            {d.name}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-3">
            <span>{d.kind === "s3" ? "S3 bucket" : "Webhook"}</span>
            <DestinationStatus destination={d} />
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-5 overflow-y-auto px-6 pb-5">
          <StreamError message={actions.error || d.last_error || undefined} />
          {testResult && (
            <p
              role="status"
              className="rounded-md bg-muted/50 px-3 py-2 text-sm"
            >
              {testResult}
            </p>
          )}
          {d.paused_reason && d.paused_reason !== "manual" && (
            <p className="text-sm text-muted-foreground">{d.paused_reason}</p>
          )}
          <dl className="grid grid-cols-3 gap-4 border-y border-sidebar-border py-4">
            {[
              ["Delivered events", d.delivered_count.toLocaleString()],
              ["Delivery lag", streamLag(d.lag_seconds)],
              ["Consecutive failures", String(d.consecutive_failures)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <dl className="grid gap-5 text-sm sm:grid-cols-2">
            {connection.map(([label, value]) => (
              <div key={label} className="min-w-0 space-y-2 sm:col-span-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="break-all rounded-md border border-sidebar-border bg-muted/40 px-3 py-2.5 font-mono text-[13px] font-medium leading-relaxed">
                  {value}
                </dd>
              </div>
            ))}
            <div className="space-y-1.5">
              <dt className="text-xs text-muted-foreground">Last delivery</dt>
              <dd className="font-semibold tabular-nums">
                {streamDate(d.last_delivered_at)}
              </dd>
            </div>
            <div className="space-y-1.5">
              <dt className="text-xs text-muted-foreground">
                IP address and city
              </dt>
              <dd className="font-semibold">
                {d.include_ip ? "Included" : "Excluded"}
              </dd>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Event types</dt>
              <dd className="flex flex-wrap gap-1.5">
                {d.event_types.map((type) => (
                  <span
                    key={type}
                    className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground"
                  >
                    {EVENT_TYPE_LABELS[type]}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
          <Collapsible className="border-t border-sidebar-border pt-2">
            <CollapsibleTrigger className="group flex w-full items-center justify-between py-2 text-sm text-muted-foreground hover:text-foreground">
              Delivery details
              <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <dl className="grid gap-x-6 gap-y-4 text-xs sm:grid-cols-2">
                {diagnostics.map(([label, value]) => (
                  <div key={label} className="min-w-0 space-y-1">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="break-words">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Delivery lag measures the age of the analytics bookmark. Active
                means delivery is turned on; it does not confirm that events
                have arrived.
              </p>
            </CollapsibleContent>
          </Collapsible>
        </div>
        {admin && (
          <div className="shrink-0 border-t px-6 py-4">
            <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    id={`event-destination-actions-${d.id}`}
                    className="sm:mr-auto"
                    disabled={actions.pending}
                  >
                    Actions <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-52 [&_[role=menuitem]]:py-2"
                >
                  <DropdownMenuItem
                    onSelect={() => {
                      void actions.run(() =>
                        eventStreamApi.action(
                          projectId,
                          d.id,
                          d.status === "paused" ? "resume" : "pause"
                        )
                      );
                    }}
                  >
                    {d.status === "paused" ? <Play /> : <Pause />}
                    {d.status === "paused"
                      ? "Resume delivery"
                      : "Pause delivery"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onReplay}>
                    <RotateCcw />
                    Replay events
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                    <Trash2 />
                    Delete destination
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                disabled={actions.pending}
                onClick={onEdit}
              >
                Edit
              </Button>
              <Button
                className="col-span-2 sm:col-auto"
                disabled={actions.pending}
                onClick={test}
              >
                {testing ? "Sending…" : "Send test event"}
              </Button>
            </div>
            {d.status === "paused" && (
              <p className="mt-2 text-right text-xs text-muted-foreground">
                Test events send even while delivery is paused.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
