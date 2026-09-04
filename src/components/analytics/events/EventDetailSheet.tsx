"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useAnalyticsEventDetailQuery } from "@/hooks/queries/useAnalyticsEventsQueries";
import { PlatformIcon } from "@/components/analytics/shared";
import { handleCopyText } from "@/lib/copyTextHelper";
import { cn, countryName, formatPlatformName } from "@/lib/utils";
import type { EventOccurrence } from "./types";
import { JsonHighlight, formatPropertyValue } from "./EventJson";

interface EventDetailSheetProps {
  event: EventOccurrence | null;
  projectId: string | undefined;
  onClose: () => void;
  onOpenVisitor: (visitorId: string) => void;
}

const dash = (v: string | undefined) => (v && v.trim() ? v : "—");

export default function EventDetailSheet({
  event,
  projectId,
  onClose,
  onOpenVisitor,
}: EventDetailSheetProps) {
  const [rawOpen, setRawOpen] = useState(false);

  // The list endpoint omits `properties` (returns null) and returns a slimmer
  // shape than the detail endpoint. Fetch the full event so Properties / Raw
  // JSON and the visitor identity (visitor_uuid / resolved_visitor_id) populate.
  const detailQuery = useAnalyticsEventDetailQuery(projectId, event?.id);
  const detail = detailQuery.data;

  if (!event) return null;

  // Visitor identity comes from the detail endpoint. Display the uuid (same id
  // the Audience table shows); click-through uses resolved_visitor_id ?? visitor_id
  // (numeric PK the /visitors/{id} endpoint accepts). null = non-linkable.
  const rawVisitorId =
    event.resolved_visitor_id ??
    detail?.resolved_visitor_id ??
    (event.user_id ? Number(event.user_id) : null);
  const linkableVisitorId =
    rawVisitorId && rawVisitorId > 0 ? rawVisitorId : null;
  const visitorLabel =
    event.visitor_uuid ??
    detail?.visitor_uuid ??
    (event.user_id && event.user_id !== "0" ? event.user_id : "");

  // Two fields per row — order drives the two-column flow.
  const fields: {
    label: string;
    value: string;
    mono?: boolean;
    copy?: boolean;
    platform?: boolean;
    visitor?: boolean;
  }[] = [
    { label: "User", value: visitorLabel, visitor: true },
    { label: "Session", value: event.session_id, mono: true, copy: true },
    {
      label: "Platform",
      value: formatPlatformName(event.platform),
      platform: true,
    },
    { label: "Version", value: event.app_version },
    { label: "Device", value: event.device_model },
    // SDK-tracked events sometimes send os_version "0" — treat it as unknown.
    { label: "OS", value: event.os_version === "0" ? "" : event.os_version },
    { label: "City", value: event.city },
    { label: "Country", value: countryName(event.country) },
  ];

  // Prefer the full detail payload; fall back to the list row while it loads.
  const properties = Object.entries(
    detail?.properties ?? event.properties ?? {}
  );
  const rawObject = detail ?? event;
  const formattedTimestamp = new Date(event.timestamp).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }
  );

  return (
    <Sheet open={!!event} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-1.5">
          <SheetTitle className="flex items-center gap-2 pr-6 text-base font-semibold leading-tight">
            <span className="truncate">{event.event_name}</span>
            <Badge
              variant="outline"
              className="shrink-0 border-sidebar-border font-mono text-[10px] font-normal text-muted-foreground"
            >
              {event.event_type}
            </Badge>
          </SheetTitle>
          <SheetDescription>{formattedTimestamp}</SheetDescription>
        </SheetHeader>

        {/* Metadata — single-column label / value */}
        <div className="border-t border-sidebar-border px-4 py-3">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-6 gap-y-2.5">
            {fields.map((f) => (
              <div key={f.label} className="contents">
                <dt className="text-xs text-muted-foreground">{f.label}</dt>
                <dd className="min-w-0">
                  {f.visitor ? (
                    <div className="group flex w-full min-w-0 items-center gap-1">
                      {linkableVisitorId ? (
                        <button
                          type="button"
                          title="View visitor details"
                          onClick={() =>
                            onOpenVisitor(String(linkableVisitorId))
                          }
                          className="truncate font-mono text-xs text-[var(--chart-users)] hover:underline"
                        >
                          {dash(f.value)}
                        </button>
                      ) : (
                        <span
                          title={f.value || undefined}
                          className="truncate font-mono text-xs"
                        >
                          {dash(f.value)}
                        </span>
                      )}
                      {f.value && (
                        <button
                          type="button"
                          aria-label="Copy user id"
                          onClick={() => handleCopyText(f.value)}
                          className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                        >
                          <Copy className="size-3" />
                        </button>
                      )}
                    </div>
                  ) : f.platform ? (
                    <span className="flex items-center gap-1.5 text-xs">
                      <PlatformIcon platform={event.platform} alt="" />
                      {dash(f.value)}
                    </span>
                  ) : f.copy && f.value ? (
                    <button
                      type="button"
                      title="Click to copy"
                      onClick={() => handleCopyText(f.value)}
                      className="group flex w-full min-w-0 items-center gap-1"
                    >
                      <span className="truncate font-mono text-xs">
                        {f.value}
                      </span>
                      <Copy className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  ) : (
                    <span
                      title={f.value || undefined}
                      className={cn(
                        "block truncate text-xs",
                        f.mono && "font-mono"
                      )}
                    >
                      {dash(f.value)}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </div>
        </div>

        {/* Event Properties — matches the SDK Attributes style in visitor details */}
        {(detailQuery.isLoading || properties.length > 0) && (
          <div className="border-t border-sidebar-border px-4 py-3">
            <div className="mb-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Event Properties</label>
                {!detailQuery.isLoading && (
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {properties.length}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                Custom properties sent with this event
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {detailQuery.isLoading
                ? [0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-[42px] animate-pulse rounded-lg border border-sidebar-border bg-secondary/50"
                    />
                  ))
                : properties.map(([key, val]) => {
                    const display = formatPropertyValue(val);
                    return (
                      <div
                        key={key}
                        className="flex items-center overflow-hidden rounded-lg border border-sidebar-border bg-secondary/50"
                      >
                        <div className="flex min-w-[140px] items-center border-r border-sidebar-border bg-secondary px-3 py-2.5">
                          <span
                            title={key}
                            className="truncate font-mono text-sm font-medium"
                          >
                            {key}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 px-3 py-2.5">
                          <span
                            title={display}
                            className="block truncate font-mono text-sm text-muted-foreground"
                          >
                            {display}
                          </span>
                        </div>
                        <button
                          type="button"
                          aria-label={`Copy ${key}`}
                          onClick={() => handleCopyText(display)}
                          className="flex items-center justify-center border-l border-sidebar-border px-3 py-2.5 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
            </div>
          </div>
        )}

        {/* Raw JSON — fixed-height header so toggling Copy doesn't shift layout */}
        <div className="border-t border-sidebar-border px-4 py-3">
          <div className="flex h-7 items-center justify-between">
            <button
              type="button"
              onClick={() => setRawOpen(!rawOpen)}
              className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {rawOpen ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              Raw JSON
            </button>
            {rawOpen && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() =>
                  handleCopyText(JSON.stringify(rawObject, null, 2))
                }
              >
                <Copy className="size-3.5" />
                Copy
              </Button>
            )}
          </div>
          {rawOpen && (
            <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-sidebar-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground/70">
              <code className="font-mono">
                <JsonHighlight value={rawObject} />
              </code>
            </pre>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
