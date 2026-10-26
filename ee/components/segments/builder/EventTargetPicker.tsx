"use client";
import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { eventTypeLabel } from "@ee/lib/segmentLabels";
import type { EventCondition } from "@ee/types/segments";
import { useFieldOptions } from "./ValuePicker";

interface Props {
  projectId: string;
  condition: EventCondition;
  eventTypes: string[];
  onChange: (
    patch: Pick<EventCondition, "any" | "event_type" | "event_name">
  ) => void;
}

// One control for "what did they do": any activity, a built-in event type, or a recorded custom event name.
export default function EventTargetPicker({
  projectId,
  condition,
  eventTypes,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const custom = useFieldOptions(projectId, "event_name", term);
  const t = term.trim().toLowerCase();
  const builtIns = [
    { value: "any", label: "Any activity" },
    ...eventTypes.map((v) => ({
      value: v,
      label: v === "custom" ? "Any custom event" : eventTypeLabel(v),
    })),
  ].filter((o) => !t || o.label.toLowerCase().includes(t));
  const current = condition.any
    ? "Any activity"
    : condition.event_name
      ? condition.event_name
      : condition.event_type
        ? eventTypeLabel(condition.event_type)
        : "Choose an event";
  const pick = (
    patch: Pick<EventCondition, "any" | "event_type" | "event_name">
  ) => {
    onChange(patch);
    setOpen(false);
    setTerm("");
  };
  const isActive = (kind: "any" | "type" | "name", v?: string) =>
    kind === "any"
      ? !!condition.any
      : kind === "type"
        ? condition.event_type === v
        : condition.event_name === v;
  const row = (active: boolean, label: string, hint?: string) => (
    <>
      <span className="mr-1 flex size-4 shrink-0 items-center justify-center">
        {active && <Check className="size-3.5 text-primary" />}
      </span>
      <span className={cn("truncate", active && "font-medium")}>{label}</span>
      {hint && (
        <span className="ml-auto pl-2 text-[11px] text-muted-foreground">
          {hint}
        </span>
      )}
    </>
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 min-w-36 justify-between font-normal"
          aria-label="Event target"
          aria-expanded={open}
        >
          {current}
          <ChevronDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="flex max-h-[min(480px,var(--radix-popover-content-available-height))] w-72 flex-col overflow-hidden p-0"
      >
        <Command shouldFilter={false} className="flex min-h-0 flex-1 flex-col">
          <CommandInput
            placeholder="Search events…"
            value={term}
            onValueChange={setTerm}
          />
          <CommandList className="min-h-0 flex-1 overflow-y-auto">
            <CommandEmpty>No matching events</CommandEmpty>
            <CommandGroup>
              {builtIns.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`b:${o.value}`}
                  onSelect={() =>
                    pick(
                      o.value === "any"
                        ? {
                            any: true,
                            event_type: undefined,
                            event_name: undefined,
                          }
                        : {
                            any: undefined,
                            event_type: o.value,
                            event_name: undefined,
                          }
                    )
                  }
                >
                  {row(
                    o.value === "any"
                      ? isActive("any")
                      : isActive("type", o.value),
                    o.label,
                    o.value === "any" ? undefined : "built-in"
                  )}
                </CommandItem>
              ))}
              {custom.loading ? (
                <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading custom
                  events…
                </div>
              ) : (
                custom.options
                  .filter((o) => !t || o.value.toLowerCase().includes(t))
                  .map((o) => (
                    <CommandItem
                      key={o.value}
                      value={`n:${o.value}`}
                      onSelect={() =>
                        pick({
                          any: undefined,
                          event_type: undefined,
                          event_name: o.value,
                        })
                      }
                    >
                      {row(isActive("name", o.value), o.value, "custom")}
                    </CommandItem>
                  ))
              )}
              {!custom.loading && custom.options.length === 0 && !t && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  No custom events recorded in the last 90 days.
                </p>
              )}
              {custom.hasMore && (
                <CommandItem
                  value="__more"
                  onSelect={() => void custom.fetchMore()}
                  className="justify-center text-xs text-muted-foreground"
                >
                  Load more custom events
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
