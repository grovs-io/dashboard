import {
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  max,
  min,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { AnalyticsGranularity } from "@/types";

export const GRANULARITIES: readonly AnalyticsGranularity[] = [
  "day",
  "week",
  "month",
];

export function isGranularity(v: string): v is AnalyticsGranularity {
  return (GRANULARITIES as readonly string[]).includes(v);
}

/** Daily up to ~3 months, weekly up to a year, monthly beyond. */
export function defaultGranularity(
  from: Date | undefined,
  to: Date | undefined
): AnalyticsGranularity {
  if (!from || !to) return "day";
  const days = differenceInCalendarDays(to, from) + 1;
  if (days <= 92) return "day";
  if (days <= 366) return "week";
  return "month";
}

/** Judges "auto" on the snapped range; the pre-snap range could flip away from the clicked one. */
export function chooseGranularity(
  g: AnalyticsGranularity,
  range: { from: Date; to: Date } | undefined,
  now: Date,
  minDate?: Date
): {
  range: { from: Date; to: Date } | undefined;
  param: AnalyticsGranularity | "auto";
} {
  const next =
    range && g !== "day"
      ? snapRangeToGranularity(range, g, now, minDate)
      : range;
  const param = g === defaultGranularity(next?.from, next?.to) ? "auto" : g;
  return { range: next, param };
}

/** Snap a range to whole weeks/months for `g`, never extending past `now` or before `minDate`. */
export function snapRangeToGranularity(
  range: { from: Date; to: Date },
  g: AnalyticsGranularity,
  now: Date,
  minDate?: Date
): { from: Date; to: Date } {
  if (g === "day") return range;
  const endOfNow = endOfDay(now);
  const clampFrom = (d: Date) => (minDate ? max([d, minDate]) : d);
  if (g === "week") {
    return {
      from: clampFrom(startOfWeek(range.from, { weekStartsOn: 1 })),
      to: min([endOfWeek(range.to, { weekStartsOn: 1 }), endOfNow]),
    };
  }
  return {
    from: clampFrom(startOfMonth(range.from)),
    to: min([endOfMonth(range.to), endOfNow]),
  };
}
