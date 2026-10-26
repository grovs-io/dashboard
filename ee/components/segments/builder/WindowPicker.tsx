"use client";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { SegmentWindow } from "@ee/types/segments";

interface Props {
  value: SegmentWindow | undefined;
  onChange: (window: SegmentWindow | undefined) => void;
  capDays: number;
  // Adds an "Any time" option; only acquisition windows may be absent.
  optional?: boolean;
  today?: Date;
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const PRESETS = [7, 14, 30, 60, 90, 180, 365];

export function windowLabel(value: SegmentWindow | undefined): string {
  if (!value) return "any time";
  if ("last_days" in value)
    return `in the last ${value.last_days} day${value.last_days === 1 ? "" : "s"}`;
  return `between ${format(parseISO(value.from), "MMM d")} and ${format(parseISO(value.to), "MMM d, yyyy")}`;
}

export default function WindowPicker({
  value,
  onChange,
  capDays,
  optional = false,
  today = new Date(),
}: Props) {
  const [open, setOpen] = useState(false);
  const presets = PRESETS.filter((d) => d <= capDays);
  const rolling = value && "last_days" in value ? value.last_days : null;
  const fixed = value && "from" in value ? value : null;
  const [custom, setCustom] = useState(
    rolling !== null && !presets.includes(rolling)
  );
  const item = (active: boolean, label: string, onClick: () => void) => (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
        active && "bg-muted font-medium"
      )}
    >
      <span
        className={cn(
          "flex size-4 items-center justify-center",
          active ? "text-primary" : "text-transparent"
        )}
      >
        <Check className="size-3.5" />
      </span>
      {label}
    </button>
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 font-normal"
          aria-label="Time window"
          aria-expanded={open}
        >
          <CalendarDays className="size-3.5 text-muted-foreground" />
          {windowLabel(value)}
          <ChevronDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="flex gap-3">
          <div
            role="radiogroup"
            aria-label="Window type"
            className="w-48 space-y-0.5"
          >
            {optional &&
              item(!value, "Any time", () => {
                setCustom(false);
                onChange(undefined);
                setOpen(false);
              })}
            {presets.map((d) =>
              item(!custom && rolling === d, `Last ${d} days`, () => {
                setCustom(false);
                onChange({ last_days: d });
                setOpen(false);
              })
            )}
            {item(
              custom || (rolling !== null && !presets.includes(rolling)),
              "Custom number of days",
              () => {
                setCustom(true);
                onChange({ last_days: rolling ?? Math.min(45, capDays) });
              }
            )}
            {item(!!fixed, "Date range", () => {
              setCustom(false);
              if (!fixed) onChange({ from: iso(today), to: iso(today) });
            })}
            {(custom || (rolling !== null && !presets.includes(rolling))) && (
              <div className="flex items-center gap-2 px-2 pt-2 text-sm">
                <span>Last</span>
                <Input
                  type="number"
                  aria-label="Days"
                  className="h-8 w-20"
                  min={1}
                  max={capDays}
                  value={rolling ?? ""}
                  onChange={(e) =>
                    onChange({
                      last_days: Math.max(
                        1,
                        Math.min(capDays, Number(e.target.value) || 1)
                      ),
                    })
                  }
                />
                <span className="text-muted-foreground">days</span>
              </div>
            )}
            <p className="px-2 pt-1 text-[11px] text-muted-foreground">
              Up to {capDays} days back.
            </p>
          </div>
          {fixed && (
            <Calendar
              mode="range"
              numberOfMonths={2}
              disabled={{ after: today }}
              selected={{ from: parseISO(fixed.from), to: parseISO(fixed.to) }}
              onSelect={(range) => {
                if (!range?.from) return;
                onChange({
                  from: iso(range.from),
                  to: iso(range.to ?? range.from),
                });
              }}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
