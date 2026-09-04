// components/date-range-picker.tsx

"use client";

import { useState, type ReactNode } from "react";
import { endOfDay, format, startOfDay, sub } from "date-fns";
import { DateRange, type Matcher } from "react-day-picker";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type Unit = "minutes" | "hours" | "days" | "weeks" | "months" | "years";
export type Preset = {
  label: string;
  value?: number;
  duration?: Unit;
  range?: (now: Date) => DateRange;
};

const defaultPresets: Preset[] = [
  { label: "Today", value: 0, duration: "days" },
  { label: "Last week", value: 1, duration: "weeks" },
  { label: "Last month", value: 1, duration: "months" },
  { label: "Last 3 months", value: 3, duration: "months" },
];

const presetStart = (preset: Preset, now: Date): Date => {
  if (preset.range) return preset.range(now).from ?? now;
  if (preset.value == null || !preset.duration) return now;
  const start = sub(now, { [preset.duration]: preset.value });
  return preset.duration === "minutes" || preset.duration === "hours"
    ? start
    : startOfDay(start);
};

const timeOfDay = (d: Date | undefined): string =>
  d ? format(d, "HH:mm") : "";

/** Return a copy of `d` with its hours/minutes set from an "HH:mm" string. */
const withTimeOfDay = (d: Date, hhmm: string): Date => {
  const [h, m] = hhmm.split(":").map(Number);
  const next = new Date(d);
  next.setHours(h ?? 0, m ?? 0, 0, 0);
  return next;
};

export function DateRangePicker({
  date,
  setDate,
  presets = defaultPresets,
  defaultPresetLabel,
  minDate,
  maxDate,
  footer,
  withTime = false,
  presetsPosition = "left",
  onUpgrade,
}: {
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
  presets?: Preset[];
  defaultPresetLabel?: string;
  /** Oldest selectable date — earlier days are disabled (plan retention limit). */
  minDate?: Date;
  /** Newest selectable date. */
  maxDate?: Date;
  /** Slot rendered under the presets column — e.g. an upgrade CTA. */
  footer?: ReactNode;
  /**
   * When provided, presets that fall outside the retention window become
   * locked (not disabled): clicking one opens the upgrade flow instead of
   * selecting it. Omit for plans with nothing to upgrade to (enterprise) —
   * those presets just stay disabled.
   */
  onUpgrade?: () => void;
  /**
   * Enable time-of-day selection: From/To time inputs + an Apply button. The
   * range is committed on Apply (not on each calendar click) so the user can
   * set day and time together. Presets still apply immediately.
   */
  withTime?: boolean;
  /** Which side of the calendar the preset list sits on. */
  presetsPosition?: "left" | "right";
}) {
  const [activePresetLabel, setActivePresetLabel] = useState<
    string | undefined
  >(defaultPresetLabel);
  const [open, setOpen] = useState(false);
  // In time mode the user edits a draft and commits on Apply.
  const [draft, setDraft] = useState<DateRange | undefined>(date);
  // Controlled displayed month so presets (Today, Last hour…) can snap the
  // calendar back to the relevant month instead of leaving it where the user
  // last navigated.
  const [month, setMonth] = useState<Date>(date?.from ?? new Date());

  // With an upgrade path, pre-retention days stay enabled-but-locked (clicking
  // them opens the upsell). Without one (enterprise), disable them outright.
  const lockOldDays = !!minDate && !!onUpgrade;
  const disabledMatchers: Matcher[] = [];
  if (minDate && !onUpgrade) disabledMatchers.push({ before: minDate });
  if (maxDate) disabledMatchers.push({ after: maxDate });

  const isBeforeMin = (range: DateRange | undefined): boolean =>
    !!minDate && !!range?.from && range.from < minDate;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      // Re-seed the draft + month from the committed value on each open. In
      // date-only mode the draft holds the in-progress click, so it starts empty.
      setDraft(withTime ? date : undefined);
      setMonth(date?.from ?? new Date());
    } else if (!withTime) {
      // Drop a half-finished range so the next open starts clean.
      setDraft(undefined);
    }
  };

  // A click that lands before the retention limit is an upsell, not a select.
  const interceptLocked = (range: DateRange | undefined): boolean => {
    if (isBeforeMin(range) && onUpgrade) {
      setOpen(false);
      onUpgrade();
      return true;
    }
    return false;
  };

  // Date-only mode: keep the in-progress selection local so a click starts a
  // new range instead of stretching the committed one, and commit it normalized
  // to whole days — otherwise the calendar hands back midnight for both ends
  // and the end day drops out of the queried window.
  const handleCalendarSelect = (
    _range: DateRange | undefined,
    selectedDay: Date | undefined
  ) => {
    if (!selectedDay) return;
    if (interceptLocked({ from: selectedDay, to: selectedDay })) return;
    setActivePresetLabel(undefined);

    if (!draft?.from || draft.to) {
      setDraft({ from: startOfDay(selectedDay), to: undefined });
      return;
    }

    const [from, to] =
      selectedDay < draft.from
        ? [selectedDay, draft.from]
        : [draft.from, selectedDay];
    setDraft(undefined);
    setOpen(false);
    setDate({ from: startOfDay(from), to: endOfDay(to) });
  };

  // Time mode: update the draft, preserving the times already chosen.
  const handleDraftSelect = (range: DateRange | undefined) => {
    if (interceptLocked(range)) return;
    setActivePresetLabel(undefined);
    if (!range) {
      setDraft(undefined);
      return;
    }
    const next: DateRange = { from: range.from, to: range.to };
    if (range.from) {
      next.from = withTimeOfDay(range.from, timeOfDay(draft?.from) || "00:00");
    }
    if (range.to) {
      next.to = withTimeOfDay(range.to, timeOfDay(draft?.to) || "23:59");
    }
    setDraft(next);
  };

  const applyDraft = () => {
    setActivePresetLabel(undefined);
    setDate(draft);
    setOpen(false);
  };

  const triggerFormat = withTime ? "MMM d, HH:mm" : "MMM d, yyyy";
  const draftHasInvalidOrder =
    !!draft?.from && !!draft?.to && draft.from.getTime() > draft.to.getTime();

  // Compact, design-system-aligned time field — tames the native clock/spinner
  // chrome that otherwise renders oversized and inconsistent across browsers.
  const timeInputClass =
    "h-8 w-[110px] shrink-0 rounded-md border border-sidebar-border bg-background px-2 text-sm tabular-nums text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50 [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-90 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-clear-button]:hidden";

  const presetsColumn = (
    <div
      className={cn(
        "flex flex-col gap-1 border-sidebar-border p-3 min-w-[150px]",
        presetsPosition === "right" ? "border-l" : "border-r"
      )}
    >
      {presets.map((preset) => {
        // Presets that reach past the plan's retention window are out of range.
        const outOfRange =
          !!minDate && presetStart(preset, new Date()) < minDate;
        // With an upgrade path, keep them clickable (locked → upsell). Without
        // one (e.g. enterprise), they simply disable.
        const locked = outOfRange && !!onUpgrade;
        return (
          <Button
            key={preset.label}
            variant="ghost"
            size="sm"
            disabled={outOfRange && !onUpgrade}
            className={cn(
              "justify-start text-sm h-8",
              activePresetLabel === preset.label && "bg-accent font-medium",
              locked && "text-muted-foreground"
            )}
            onClick={() => {
              if (locked) {
                // Close the picker so the upgrade dialog isn't layered behind it.
                setOpen(false);
                onUpgrade?.();
                return;
              }
              const now = new Date();
              const range = preset.range?.(now) ?? {
                from: presetStart(preset, now),
                to: endOfDay(now),
              };
              setActivePresetLabel(preset.label);
              setDate(range);
              // Reflect the preset in the calendar + time inputs, snap the
              // calendar to the range's month, and keep the popover open so the
              // selected day stays visible and can be fine-tuned.
              setDraft(range);
              setMonth(range.from ?? now);
            }}
          >
            {preset.label}
            {locked && <Lock className="ml-auto size-3 opacity-60" />}
          </Button>
        );
      })}
      {footer && <div className="mt-1">{footer}</div>}
    </div>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-fit justify-start text-left font-normal rounded-md border-sidebar-border shadow-none hover:bg-secondary"
        >
          {activePresetLabel ? (
            <span>{activePresetLabel}</span>
          ) : date?.from ? (
            date.to ? (
              <span>
                {format(date.from, triggerFormat)} -{" "}
                {format(date.to, triggerFormat)}
              </span>
            ) : (
              <span>{format(date.from, triggerFormat)}</span>
            )
          ) : (
            <span className="text-muted-foreground">Pick a date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {presetsPosition === "left" && presetsColumn}
          <div className="flex flex-col">
            <Calendar
              mode="range"
              month={month}
              onMonthChange={setMonth}
              selected={withTime ? draft : (draft ?? date)}
              onSelect={withTime ? handleDraftSelect : handleCalendarSelect}
              numberOfMonths={2}
              disabled={
                disabledMatchers.length > 0 ? disabledMatchers : undefined
              }
              modifiers={
                lockOldDays && minDate
                  ? { locked: { before: minDate } }
                  : undefined
              }
              modifiersClassNames={{
                locked: "text-muted-foreground/40 cursor-pointer",
              }}
            />
            {withTime && (
              <div className="border-t border-sidebar-border px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      From
                    </span>
                    <input
                      type="time"
                      aria-label="Start time"
                      value={timeOfDay(draft?.from)}
                      disabled={!draft?.from}
                      onChange={(e) =>
                        draft?.from &&
                        setDraft({
                          ...draft,
                          from: withTimeOfDay(draft.from, e.target.value),
                        })
                      }
                      className={timeInputClass}
                    />
                  </div>
                  <span className="text-muted-foreground/60">&ndash;</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      To
                    </span>
                    <input
                      type="time"
                      aria-label="End time"
                      value={timeOfDay(draft?.to)}
                      disabled={!draft?.to}
                      onChange={(e) =>
                        draft?.to &&
                        setDraft({
                          ...draft,
                          to: withTimeOfDay(draft.to, e.target.value),
                        })
                      }
                      className={timeInputClass}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="ml-auto h-8"
                    onClick={applyDraft}
                    disabled={
                      !draft?.from || !draft?.to || draftHasInvalidOrder
                    }
                  >
                    Apply
                  </Button>
                </div>
                {draftHasInvalidOrder && (
                  <p className="mt-2 text-[11px] text-destructive">
                    Start must be before end.
                  </p>
                )}
              </div>
            )}
          </div>
          {presetsPosition === "right" && presetsColumn}
        </div>
      </PopoverContent>
    </Popover>
  );
}
