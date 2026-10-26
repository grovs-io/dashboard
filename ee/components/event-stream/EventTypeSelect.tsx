"use client";

import { useId, useState } from "react";
import { EVENT_TYPE_LABELS } from "./eventTypeLabels";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DEFAULT_STREAM_TYPES,
  EVENT_STREAM_TYPES,
} from "@ee/types/eventStream";

export default function EventTypeSelect({
  selected,
  onChange,
  disabled,
}: {
  selected: string[];
  onChange: (types: string[]) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const matching = EVENT_STREAM_TYPES.filter((type) =>
    `${EVENT_TYPE_LABELS[type]} ${type}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Event types</Label>
      {selected.map((type) => (
        <input key={type} type="hidden" name="event_types" value={type} />
      ))}
      {/* Keep the portaled options inside the active scroll lock of the dialog. */}
      <Popover modal onOpenChange={() => setSearch("")}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className="w-full justify-between font-normal"
            aria-describedby={`${id}-hint`}
          >
            <span>
              {selected.length
                ? `${selected.length} event types selected`
                : "Select event types"}
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="flex max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] flex-col p-0"
        >
          <div className="border-b p-2">
            <Input
              aria-label="Search event types"
              placeholder="Search event types…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div
            role="region"
            aria-label="Event type options"
            className="min-h-0 max-h-60 overflow-y-auto overscroll-contain p-1"
          >
            {matching.map((type) => (
              <label
                key={type}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted"
              >
                <Checkbox
                  disabled={disabled}
                  checked={selected.includes(type)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked
                        ? [...selected, type]
                        : selected.filter((value) => value !== type)
                    )
                  }
                />
                <span className="flex-1 text-sm">
                  {EVENT_TYPE_LABELS[type]}
                </span>
                {(type === "screen_view" || type === "time_spent") && (
                  <span className="text-xs text-muted-foreground">
                    High volume
                  </span>
                )}
              </label>
            ))}
            {!matching.length && (
              <p className="p-3 text-sm text-muted-foreground">
                No event types found.
              </p>
            )}
          </div>
          <div className="flex justify-between border-t p-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-primary hover:text-primary"
              disabled={disabled}
              onClick={() => onChange([...EVENT_STREAM_TYPES])}
            >
              Select all
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-primary hover:text-primary"
              disabled={disabled}
              onClick={() => onChange([...DEFAULT_STREAM_TYPES])}
            >
              Reset to defaults
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        Choose which events to send. Screen views and time spent are high
        volume.
      </p>
    </div>
  );
}
