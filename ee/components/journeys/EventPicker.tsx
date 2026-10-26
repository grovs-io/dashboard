"use client";
import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
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
import { useFieldOptions } from "@ee/components/segments/builder/ValuePicker";
import {
  MESSAGE_EVENTS,
  SYSTEM_EVENTS,
  SYSTEM_EVENT_INFO,
} from "@ee/types/experiment";
import type { JourneyEvent } from "@ee/types/journey";

const HIDDEN = new Set<string>(MESSAGE_EVENTS);

export function eventPickerLabel(value: JourneyEvent | null): string {
  if (value?.system) return SYSTEM_EVENT_INFO[value.system].label;
  if (value?.screen) return `Screen: ${value.screen}`;
  return value?.name || "Choose an event";
}

// Built-in events first, then the project's custom events and screens; a typed name is accepted too.
export default function EventPicker({
  projectId,
  label,
  value,
  onChange,
}: {
  projectId: string;
  label: string;
  value: JourneyEvent | null;
  onChange: (value: JourneyEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const events = useFieldOptions(
    projectId,
    open ? "event_name" : undefined,
    term
  );
  const screens = useFieldOptions(
    projectId,
    open ? "screen_name" : undefined,
    term
  );
  const t = term.trim();
  const match = (text: string) =>
    !t || text.toLowerCase().includes(t.toLowerCase());
  const pick = (next: JourneyEvent) => {
    onChange(next);
    setOpen(false);
    setTerm("");
  };
  const custom = events.options.filter(
    (o) => !HIDDEN.has(o.value) && match(o.value)
  );
  const views = screens.options.filter((o) => match(o.value));
  const row = (active: boolean, text: string) => (
    <>
      <span className="mr-1 flex size-4 shrink-0 items-center justify-center">
        {active && <Check className="size-3.5 text-primary" />}
      </span>
      <span className={cn("truncate", active && "font-medium")}>{text}</span>
    </>
  );
  const loading = (
    <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Loading…
    </div>
  );
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full min-w-0 justify-between font-normal"
          aria-label={label}
          aria-expanded={open}
        >
          <span className="truncate">{eventPickerLabel(value)}</span>
          <ChevronDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="flex max-h-[min(440px,var(--radix-popover-content-available-height))] w-72 flex-col overflow-hidden p-0"
      >
        <Command shouldFilter={false} className="flex min-h-0 flex-1 flex-col">
          <CommandInput
            placeholder="Search or type a name…"
            value={term}
            onValueChange={setTerm}
          />
          <CommandList className="min-h-0 flex-1 overflow-y-auto">
            <CommandGroup heading="Built-in">
              {SYSTEM_EVENTS.filter((v) =>
                match(SYSTEM_EVENT_INFO[v].label)
              ).map((v) => (
                <CommandItem
                  key={v}
                  value={`s:${v}`}
                  onSelect={() =>
                    pick({ system: v, name: null, screen: null, filters: [] })
                  }
                >
                  {row(value?.system === v, SYSTEM_EVENT_INFO[v].label)}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Custom events">
              {events.loading
                ? loading
                : custom.map((o) => (
                    <CommandItem
                      key={o.value}
                      value={`e:${o.value}`}
                      onSelect={() =>
                        pick({
                          name: o.value,
                          screen: null,
                          system: null,
                          filters: value?.name ? (value.filters ?? []) : [],
                        })
                      }
                    >
                      {row(value?.name === o.value, o.value)}
                    </CommandItem>
                  ))}
              {t && !custom.some((o) => o.value === t) && (
                <CommandItem
                  value={`e+:${t}`}
                  onSelect={() =>
                    pick({ name: t, screen: null, system: null, filters: [] })
                  }
                >
                  {row(false, `Use event “${t}”`)}
                </CommandItem>
              )}
            </CommandGroup>
            <CommandGroup heading="Screens">
              {screens.loading
                ? loading
                : views.map((o) => (
                    <CommandItem
                      key={o.value}
                      value={`v:${o.value}`}
                      onSelect={() =>
                        pick({
                          screen: o.value,
                          name: null,
                          system: null,
                          filters:
                            value?.screen != null ? (value.filters ?? []) : [],
                        })
                      }
                    >
                      {row(value?.screen === o.value, o.value)}
                    </CommandItem>
                  ))}
              {t && !views.some((o) => o.value === t) && (
                <CommandItem
                  value={`v+:${t}`}
                  onSelect={() =>
                    pick({ screen: t, name: null, system: null, filters: [] })
                  }
                >
                  {row(false, `Use screen “${t}”`)}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
