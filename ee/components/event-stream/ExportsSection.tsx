"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Check, Plus } from "lucide-react";
import {
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  DateRangePicker,
  type Preset,
} from "@/components/dateRangePicker/DateRangePicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AnalyticsRetention } from "@/types/instance";
import type { EventDestination, EventExportInput } from "@ee/types/eventStream";
import type { StreamActions } from "@ee/hooks/mutations/useEventStreamActions";
import { eventStreamApi } from "@ee/api/event-stream/eventStreamService";
import { exportInput, streamError } from "@ee/lib/eventStream";
import { ConfirmAction, StreamError, StreamSelect } from "./StreamUi";

const presets: Preset[] = [
  { label: "Today", value: 0, duration: "days" },
  { label: "Last 7 days", value: 6, duration: "days" },
  { label: "Last 30 days", value: 29, duration: "days" },
  { label: "Last 90 days", value: 89, duration: "days" },
];

export default function ExportsSection({
  projectId,
  destinations,
  admin,
  retention,
  actions,
}: {
  projectId: string;
  destinations: EventDestination[];
  admin: boolean;
  retention?: AnalyticsRetention;
  actions: StreamActions;
}) {
  const dateId = useId();
  const today = startOfDay(new Date());
  const minDate = retention
    ? subDays(today, retention.queryable_days)
    : undefined;
  const [date, setDate] = useState<DateRange | undefined>(() => ({
    from: subDays(today, Math.min(6, retention?.queryable_days ?? 6)),
    to: today,
  }));
  const [destinationId, setDestinationId] = useState("email");
  const [error, setError] = useState("");
  const [review, setReview] = useState<EventExportInput>();
  const [success, setSuccess] = useState<{
    input: EventExportInput;
    destinationName?: string;
  }>();
  const successHeading = useRef<HTMLHeadingElement>(null);
  const startExportButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!success) return;
    const frame = requestAnimationFrame(() => successHeading.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [success]);
  const target = destinations.find((d) => d.id === destinationId);
  const selected = review?.destination_id
    ? destinations.find((d) => d.id === review.destination_id)
    : undefined;
  const start = date?.from ? format(date.from, "yyyy-MM-dd") : "";
  const end = date?.to ? format(date.to, "yyyy-MM-dd") : "";
  let rangeError = "";
  try {
    exportInput(start, end);
    if (minDate && date?.from && date.from < minDate)
      rangeError = "Choose dates within your plan’s retained history.";
    else if (end > format(today, "yyyy-MM-dd"))
      rangeError = "Choose an end date of today or earlier.";
  } catch (cause) {
    rangeError = streamError(cause);
  }
  const dayCount = rangeError
    ? undefined
    : differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
  const edit = () => {
    setError("");
    setSuccess(undefined);
    actions.clearError();
  };

  if (!admin)
    return (
      <p className="text-sm text-muted-foreground">
        An instance admin can export historical events to an emailed download or
        a destination.
      </p>
    );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    edit();
    if (rangeError) {
      setError(rangeError);
      return;
    }
    if (destinationId !== "email" && !target) {
      setError("Choose a destination for this export.");
      return;
    }
    try {
      setReview(exportInput(start, end, target?.id));
    } catch (cause) {
      setError(streamError(cause));
    }
  };
  const execute = async () => {
    if (!review) return;
    if (review.destination_id && !selected) {
      setError("This destination no longer exists. Choose another target.");
      setReview(undefined);
      return;
    }
    const result = await actions.run(() =>
      eventStreamApi.export(projectId, review)
    );
    if (result) {
      setSuccess({ input: review, destinationName: selected?.name });
      setReview(undefined);
    }
  };
  if (success)
    return (
      <section aria-label="Requested export" className="max-w-md space-y-6">
        <div role="status" className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-valid-green/10 text-valid-green">
            <Check className="size-4" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2
              ref={successHeading}
              tabIndex={-1}
              className="text-lg font-semibold tracking-tight outline-none"
            >
              Export requested
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {success.input.destination_id
                ? "Your request is confirmed. Events will be sent to your destination in the background."
                : "We’ll email you a download link as soon as it’s ready."}
            </p>
          </div>
        </div>
        <dl className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Date range</dt>
            <dd className="mt-1 text-sm font-medium">
              {format(
                parseISO(success.input.start_date),
                success.input.start_date.slice(0, 4) ===
                  success.input.end_date.slice(0, 4)
                  ? "MMM d"
                  : "MMM d, yyyy"
              )}{" "}
              – {format(parseISO(success.input.end_date), "MMM d, yyyy")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Delivery</dt>
            <dd className="mt-1 break-words text-sm font-medium">
              {success.destinationName ?? "Email download"}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          {success.input.destination_id
            ? "Your live delivery settings stay unchanged."
            : "The download link expires 24 hours after it’s created."}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            edit();
            setDate({
              from: subDays(today, Math.min(6, retention?.queryable_days ?? 6)),
              to: today,
            });
            setDestinationId("email");
            requestAnimationFrame(() =>
              document.getElementById(dateId)?.focus()
            );
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          Create another export
        </Button>
      </section>
    );
  return (
    <div className="max-w-md space-y-5">
      <StreamError message={error} />
      <form onSubmit={submit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor={dateId}>Date range</Label>
          <DateRangePicker
            id={dateId}
            compact
            disabled={actions.pending}
            date={date}
            setDate={(value) => {
              edit();
              setDate(value);
            }}
            presets={presets}
            minDate={minDate}
            maxDate={today}
          />
          {rangeError ? (
            <p role="alert" className="text-xs text-destructive">
              {rangeError}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {dayCount} {dayCount === 1 ? "day" : "days"} selected · Up to 92
              days per export.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <StreamSelect
            label="Send export to"
            name="destination_id"
            value={destinationId}
            onValueChange={(value) => {
              edit();
              setDestinationId(value);
            }}
            disabled={actions.pending}
            options={[
              { value: "email", label: "Email me a download link" },
              ...destinations.map((d) => ({
                value: d.id,
                label: `${d.name} (${d.kind === "s3" ? "S3" : "Webhook"}${d.status === "paused" ? ", paused" : ""})`,
              })),
            ]}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {destinationId === "email"
              ? "We’ll email you when it’s ready. The link is valid for 24 hours."
              : target?.status === "paused"
                ? "This export will be sent even though live delivery is paused."
                : "Uses this destination’s event types and location settings."}
          </p>
        </div>
        <Button
          ref={startExportButton}
          type="submit"
          disabled={
            actions.pending ||
            !!rangeError ||
            (destinationId !== "email" && !target)
          }
        >
          Start export
        </Button>
      </form>
      {review && (
        <ConfirmAction
          returnFocus={() => startExportButton.current}
          title="Start export?"
          description="Confirm the details below. Your export will run in the background."
          confirmLabel="Confirm export"
          pending={actions.pending}
          error={actions.error}
          onClose={() => {
            actions.clearError();
            setReview(undefined);
          }}
          onConfirm={execute}
        >
          <dl className="divide-y divide-sidebar-border text-sm">
            {[
              [
                "Date range",
                `${format(parseISO(review.start_date), "MMM d, yyyy")} – ${format(parseISO(review.end_date), "MMM d, yyyy")}`,
              ],
              [
                "Delivery",
                review.destination_id
                  ? (selected?.name ?? "Destination unavailable")
                  : "Email download",
              ],
              [
                "Events",
                selected
                  ? `${selected.event_types.length} event types`
                  : "All event types",
              ],
              [
                "Location",
                selected?.include_ip
                  ? "IP address and city included"
                  : "Country only",
              ],
              [
                "Format",
                selected?.kind === "webhook" ? "NDJSON" : "gzip NDJSON",
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          {review.destination_id ? (
            <>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Historical events may arrive alongside live events. Your
                receiver should deduplicate by event ID.
              </p>
              {selected?.status === "paused" && (
                <p className="rounded-md bg-muted p-3 text-sm">
                  This export sends data despite the pause. Ongoing delivery
                  remains paused afterward.
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              We’ll email you a download link valid for 24 hours. Purchases
              include their latest version.
            </p>
          )}
        </ConfirmAction>
      )}
    </div>
  );
}
