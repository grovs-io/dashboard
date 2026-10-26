"use client";
import { useState } from "react";
import { format, parse } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import TimeSelect from "@ee/components/push/composer/TimeSelect";

export interface DateTimePreset {
  label: string;
  value: string;
}

// The calendar + time pair used for scheduling across the app. Value is "yyyy-MM-ddTHH:mm".
export default function DateTimeField({
  label,
  value,
  onChange,
  presets = [],
  invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  presets?: DateTimePreset[];
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [day = "", time = ""] = value.split("T");
  const date = day ? parse(day, "yyyy-MM-dd", new Date()) : undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              aria-label={`${label} date`}
              aria-expanded={open}
              aria-invalid={invalid || undefined}
              className={cn(
                "justify-between font-normal sm:flex-1",
                invalid && "border-destructive/60"
              )}
            >
              <span className="flex items-center gap-2">
                <CalendarDays className="size-3.5 text-muted-foreground" />
                {date ? format(date, "EEE, d MMM yyyy") : "Pick a date"}
              </span>
              <ChevronDown className="size-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              defaultMonth={date}
              disabled={{ before: today }}
              onSelect={(d) => {
                if (!d) return;
                onChange(`${format(d, "yyyy-MM-dd")}T${time || "09:00"}`);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        <TimeSelect
          label={`${label} time`}
          value={time}
          onChange={(t) =>
            onChange(`${day || format(new Date(), "yyyy-MM-dd")}T${t}`)
          }
          className="sm:w-[140px]"
        />
      </div>
      {presets.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label={`${label} quick picks`}
        >
          {presets.map((p) => (
            <Button
              key={p.label}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(p.value)}
              className={cn(
                "h-7 rounded-full px-3 text-xs font-normal",
                value === p.value && "border-primary/60 bg-accent text-primary"
              )}
            >
              {p.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
