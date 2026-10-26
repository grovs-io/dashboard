"use client";
import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { replayTimestamp, streamError } from "@ee/lib/eventStream";
import { eventStreamApi } from "@ee/api/event-stream/eventStreamService";
import type { EventDestination } from "@ee/types/eventStream";
import type { StreamActions } from "@ee/hooks/mutations/useEventStreamActions";
import { ConfirmAction, StreamField, StreamSelect } from "./StreamUi";

export default function ReplayDialog({
  projectId,
  destination,
  actions,
  onClose,
  returnFocus,
}: {
  projectId: string;
  destination: EventDestination;
  actions: StreamActions;
  onClose: () => void;
  returnFocus: () => HTMLElement | null;
}) {
  const [preset, setPreset] = useState("hour");
  const [custom, setCustom] = useState("");
  const [review, setReview] = useState<string>();
  const [error, setError] = useState("");
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const confirm = async () => {
    setError("");
    try {
      if (!review) {
        const start =
          preset === "custom"
            ? custom
            : new Date(
                Date.now() - (preset === "hour" ? 3600_000 : 86400_000)
              ).toISOString();
        setReview(replayTimestamp(start));
      } else {
        const to = replayTimestamp(review);
        const result = await actions.run(() =>
          eventStreamApi.action(projectId, destination.id, "rewind", to)
        );
        if (result) onClose();
      }
    } catch (cause) {
      setError(streamError(cause));
    }
  };
  return (
    <ConfirmAction
      returnFocus={returnFocus}
      title={`Replay to ${destination.name}`}
      description="Replay captured events from the last seven days. Previously delivered events may be sent again; your receiver must deduplicate them."
      confirmLabel={review ? "Confirm replay" : "Review replay"}
      pending={actions.pending}
      error={error || actions.error}
      onConfirm={confirm}
      onClose={onClose}
    >
      {review ? (
        <div className="space-y-3">
          <p className="text-sm">
            Replay from <strong>{new Date(review).toLocaleString()}</strong> (
            {zone}).
          </p>
          <Button
            variant="outline"
            disabled={actions.pending}
            onClick={() => setReview(undefined)}
          >
            Change start time
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <StreamSelect
            label="Start replay from"
            value={preset}
            onValueChange={setPreset}
            options={[
              { value: "hour", label: "Last hour" },
              { value: "day", label: "Last 24 hours" },
              { value: "custom", label: "Custom time" },
            ]}
          />
          {preset === "custom" && (
            <StreamField
              label={`Start time (${zone})`}
              type="datetime-local"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              min={format(
                new Date(Date.now() - 7 * 86400_000),
                "yyyy-MM-dd'T'HH:mm"
              )}
              max={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
            />
          )}
        </div>
      )}
      {destination.status === "paused" && (
        <p className="rounded-md bg-muted p-3 text-sm">
          This destination stays paused. Resume it explicitly when you are ready
          to deliver the replay.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Need older history or events from before capture started? Use the
        Exports tab.
      </p>
    </ConfirmAction>
  );
}
