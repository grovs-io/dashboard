import { endOfDay, startOfDay, sub } from "date-fns";
import type { QueryFilter } from "@/components/analytics/events/types";
import { VOLUME_MAX_DAYS } from "./analyticsLimits";

/** Overview metric → the Explorer event_type that best explains it. */
export const METRIC_EVENT_TYPE: Record<string, string> = {
  new_users: "install",
  revenue: "purchase",
  views: "view",
  link_views: "view",
  opens: "open",
  installs: "install",
  reinstalls: "reinstall",
  link_driven_installs: "install",
  organic_installs: "install",
  app_opens: "app_open",
  referred_users: "user_referred",
};

type Chip = { f: string; v: string; o: QueryFilter["operator"]; d?: string };

/** The start is clamped to the Explorer's aggregate window so it never opens in an error state. */
export function buildExplorerHref(opts: {
  from?: Date;
  to?: Date;
  filters: QueryFilter[];
  metric?: string;
  now?: Date;
}): string {
  const now = opts.now ?? new Date();
  const to = endOfDay(opts.to ?? now);
  const floor = startOfDay(sub(to, { days: VOLUME_MAX_DAYS - 1 }));
  const requested = opts.from ? startOfDay(opts.from) : floor;
  const from =
    requested < floor ? floor : requested > to ? startOfDay(to) : requested;

  const eventType = opts.metric ? METRIC_EVENT_TYPE[opts.metric] : undefined;
  const chips: Chip[] = opts.filters
    .filter((f) => !(eventType && f.field === "event_type"))
    .map((f) => ({
      f: f.field,
      v: f.value,
      o: f.operator,
      ...(f.displayValue ? { d: f.displayValue } : {}),
    }));
  if (eventType) chips.push({ f: "event_type", v: eventType, o: "is" });

  const qs = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  if (chips.length) qs.set("filters", JSON.stringify(chips));
  return `/analytics/event_log?${qs.toString()}`;
}
