"use client";
import { useState } from "react";
import { Check, ChevronsUpDown, Clock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TIME_STEPS, parseTime } from "@ee/lib/pushComposer";

interface Props {
  value: string;
  onChange: (time: string) => void;
  className?: string;
  // Accessible name, when a form has more than one time.
  label?: string;
}

export default function TimeSelect({
  value,
  onChange,
  className,
  label = "Time",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const typed = parseTime(search);
  const pick = (time: string) => {
    onChange(time);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className={cn("justify-between font-normal tabular-nums", className)}
        >
          <span className="flex items-center gap-2">
            <Clock className="size-3.5 text-muted-foreground" />
            {value || "Pick a time"}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command defaultValue={value}>
          <CommandInput
            placeholder="Type a time, e.g. 09:07"
            className="h-9"
            value={search}
            onValueChange={setSearch}
            onKeyDown={(e) => {
              if (e.key === "Enter" && typed && !TIME_STEPS.includes(typed)) {
                e.preventDefault();
                pick(typed);
              }
            }}
          />
          <CommandList>
            <CommandEmpty>Use HH:mm, e.g. 09:07</CommandEmpty>
            {typed && !TIME_STEPS.includes(typed) && (
              <CommandGroup>
                <CommandItem
                  value={`use ${typed} ${search}`}
                  onSelect={() => pick(typed)}
                >
                  <Clock className="size-3.5" />
                  Use {typed}
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {TIME_STEPS.map((time) => (
                <CommandItem
                  key={time}
                  value={time}
                  onSelect={() => pick(time)}
                >
                  <Check
                    className={cn(
                      "size-3.5",
                      time === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="tabular-nums">{time}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
