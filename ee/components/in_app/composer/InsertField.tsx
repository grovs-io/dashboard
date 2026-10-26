"use client";
import { useState } from "react";
import { Braces, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fieldText, usableKey } from "@ee/lib/inAppComposer";
import type { InAppSuggestions } from "@ee/hooks/queries/useInAppSuggestions";

interface Props {
  // Which text the value goes into, for the button's name.
  target: string;
  suggestions: InAppSuggestions;
  // Event values exist only when an event trigger can show the message.
  withEvent: boolean;
  onInsert: (field: string) => void;
}

interface Chosen {
  source: "user" | "event";
  key: string;
}

// Choose a value, say what stands in when it is missing, then insert.
export default function InsertField({
  target,
  suggestions,
  withEvent,
  onInsert,
}: Props) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [fallback, setFallback] = useState("");
  const [chosen, setChosen] = useState<Chosen | null>(null);

  const reset = () => {
    setTerm("");
    setFallback("");
    setChosen(null);
  };
  const insert = () => {
    if (!chosen) return;
    onInsert(fieldText(chosen.source, chosen.key, fallback));
    setOpen(false);
    reset();
  };

  const typed = term.trim();
  const match = (key: string) =>
    key.toLowerCase().includes(typed.toLowerCase());
  const users = suggestions.userAttributes.filter(match);
  const events = withEvent ? suggestions.eventProperties.filter(match) : [];
  const custom =
    usableKey(typed) && !suggestions.userAttributes.includes(typed)
      ? typed
      : null;
  const is = (source: Chosen["source"], key: string) =>
    chosen?.source === source && chosen.key === key;
  const item = (source: Chosen["source"], key: string, label = key) => (
    <CommandItem
      key={`${source}:${key}`}
      value={`${source}:${key}`}
      onSelect={() => setChosen({ source, key })}
    >
      {label}
      <Check
        className={cn(
          "ml-auto size-4",
          is(source, key) ? "opacity-100" : "opacity-0"
        )}
      />
    </CommandItem>
  );

  return (
    <Popover
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-xs text-primary"
          aria-label={`Insert a value into the ${target}`}
        >
          <Braces className="size-3" />
          Insert a value
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-sidebar-border px-3 py-2">
          <p className="text-xs font-medium">1. Choose what to insert</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {withEvent
              ? "User attributes your app saves on each person with the Grovs SDK (userAttributes), or properties of the event that showed the message. Each person sees their own value."
              : "User attributes your app saves on each person with the Grovs SDK (userAttributes). Each person sees their own value."}
          </p>
        </div>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or type an attribute"
            value={term}
            onValueChange={setTerm}
          />
          <CommandList className="max-h-48">
            <CommandEmpty>
              {suggestions.loading
                ? "Loading…"
                : "No user attributes recorded yet. Type the name your app sets in userAttributes."}
            </CommandEmpty>
            {(users.length > 0 || custom) && (
              <CommandGroup heading="User attributes">
                {custom && item("user", custom, `Use “${custom}”`)}
                {users.map((key) => item("user", key))}
              </CommandGroup>
            )}
            {events.length > 0 && (
              <CommandGroup heading="Event properties">
                {events.map((key) => item("event", key))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
        <div className="space-y-2 border-t border-sidebar-border p-3">
          <div>
            <label
              htmlFor={`fallback-${target}`}
              className="text-xs font-medium"
            >
              2. Fallback text (optional)
            </label>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {chosen
                ? `Shown to people who have no ${chosen.key}. Left empty, nothing is shown in its place.`
                : "Shown to people who have no value for it. For example, “Hi {first_name}” becomes “Hi there”."}
            </p>
          </div>
          <Input
            id={`fallback-${target}`}
            placeholder="e.g. there"
            className="h-8"
            value={fallback}
            onChange={(e) => setFallback(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") insert();
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <code className="min-w-0 truncate text-[11px] text-muted-foreground">
              {chosen
                ? fieldText(chosen.source, chosen.key, fallback)
                : "Nothing chosen yet"}
            </code>
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0"
              disabled={!chosen}
              onClick={insert}
            >
              Insert
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
