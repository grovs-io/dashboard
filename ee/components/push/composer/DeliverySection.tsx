"use client";
import { useRef, useState } from "react";
import { addDays, format, parseISO, startOfDay } from "date-fns";
import {
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Clock,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { FieldError } from "@/components/common/FieldError";
import { cn } from "@/lib/utils";
import {
  scheduleError,
  schedulePresets,
  scheduleSummary,
  type ScheduleValue,
} from "@ee/lib/pushComposer";
import { viewerTimeZone } from "@ee/lib/push";
import TimeSelect from "./TimeSelect";
import TimezoneCombobox from "./TimezoneCombobox";

interface Props {
  value: ScheduleValue;
  onChange: (value: ScheduleValue) => void;
  showErrors: boolean;
}

const MODES = [
  {
    value: "now",
    label: "Send now",
    description: "Starts going out a few seconds after you confirm.",
    icon: Send,
  },
  {
    value: "schedule",
    label: "Schedule",
    description: "Pick a time up to 30 days ahead.",
    icon: Clock,
  },
] as const;

export default function DeliverySection({
  value,
  onChange,
  showErrors,
}: Props) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const modeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const set = (patch: Partial<ScheduleValue>) =>
    onChange({ ...value, ...patch });
  const date = value.date ? parseISO(value.date) : undefined;
  const complete = !!value.date && !!value.time;
  const error = showErrors || complete ? scheduleError(value) : null;
  const presets = schedulePresets(value);
  const summary = scheduleSummary(value);
  const today = startOfDay(new Date());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div
          role="radiogroup"
          aria-label="Delivery"
          className="grid h-10 grid-cols-2 rounded-lg bg-muted p-1 dark:bg-background"
          onKeyDown={(e) => {
            const step =
              e.key === "ArrowRight" || e.key === "ArrowDown"
                ? 1
                : e.key === "ArrowLeft" || e.key === "ArrowUp"
                  ? -1
                  : 0;
            if (!step) return;
            e.preventDefault();
            const index = MODES.findIndex((m) => m.value === value.mode);
            const next = MODES[(index + step + MODES.length) % MODES.length]!;
            set({ mode: next.value });
            modeRefs.current[next.value]?.focus();
          }}
        >
          {MODES.map((m) => {
            const active = value.mode === m.value;
            return (
              <button
                key={m.value}
                ref={(el) => {
                  modeRefs.current[m.value] = el;
                }}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={m.label}
                tabIndex={active ? 0 : -1}
                onClick={() => set({ mode: m.value })}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                  active
                    ? "bg-background text-foreground shadow-sm ring-1 ring-sidebar-border dark:bg-muted"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <m.icon className="size-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>
        <p className="text-[13px] text-muted-foreground">
          {MODES.find((m) => m.value === value.mode)?.description}
        </p>
      </div>

      {value.mode === "schedule" && (
        <div className="flex flex-col gap-4 rounded-lg border border-sidebar-border p-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Date and time</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Date"
                    aria-expanded={calendarOpen}
                    aria-invalid={!!error}
                    className="justify-between font-normal sm:flex-1"
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
                    disabled={{ before: today, after: addDays(today, 30) }}
                    onSelect={(d) => {
                      if (!d) return;
                      set({ date: format(d, "yyyy-MM-dd") });
                      setCalendarOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
              <TimeSelect
                value={value.time}
                onChange={(time) => set({ time })}
                className="sm:w-[160px]"
              />
            </div>
            <div
              className="flex flex-wrap gap-1.5"
              aria-label="Quick picks"
              role="group"
            >
              {presets.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!!p.error}
                  title={p.error ?? undefined}
                  onClick={() => set({ date: p.date, time: p.time })}
                  className={cn(
                    "h-7 rounded-full px-3 text-xs font-normal",
                    value.date === p.date &&
                      value.time === p.time &&
                      "border-primary/60 bg-accent text-primary"
                  )}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <FieldError message={error ?? undefined} />
            {summary && !error && (
              <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <CalendarClock className="size-3.5 shrink-0" />
                <span>{summary}</span>
              </p>
            )}
          </div>

          <div className="border-t border-sidebar-border" />

          <label className="flex items-start gap-3">
            <Switch
              checked={value.localTime}
              onCheckedChange={(localTime) => set({ localTime })}
              aria-label="Deliver in each user's local time"
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                Deliver in each user&apos;s local time
              </span>
              <span className="text-[13px] text-muted-foreground">
                {value.localTime
                  ? `Users without a known timezone get ${value.time || "09:00"} in the zone below, which also sets how much notice it needs.`
                  : `Otherwise the time is read in your timezone, ${viewerTimeZone()}.`}
              </span>
            </span>
          </label>

          {value.localTime && (
            <TimezoneCombobox
              value={value.timezone}
              onChange={(timezone) => set({ timezone })}
            />
          )}
        </div>
      )}

      {value.mode === "now" && <FieldError message={error ?? undefined} />}
    </div>
  );
}
