import { DIMENSIONS } from "@/lib/metricQuery";
import type { MetricQuery, MetricQueryMetric, StoredFilter } from "@/types";

/** Show = Event × Measure; the pair maps onto one backend metric plus at most one managed chip. */
export const EVENT_TYPES = [
  { value: "install", label: "Install", counter: "installs" },
  { value: "app_open", label: "App open", counter: "app_opens" },
  { value: "view", label: "Link view", counter: "views" },
  { value: "open", label: "Link open", counter: "opens" },
  { value: "reinstall", label: "Reinstall", counter: "reinstalls" },
  { value: "user_referred", label: "Referred user", counter: "referred_users" },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  counter: MetricQueryMetric;
}>;

export type EventType = (typeof EVENT_TYPES)[number]["value"];

export type EventChoice =
  | { kind: "any" }
  | { kind: "type"; value: EventType }
  | { kind: "link_view" }
  | { kind: "link_install" }
  | { kind: "name"; value: string };

export type Measure = "count" | "unique_visitors" | "unique_devices";

export const MEASURES: { key: Measure; label: string }[] = [
  { key: "count", label: "Count" },
  { key: "unique_visitors", label: "Unique visitors" },
  { key: "unique_devices", label: "Unique devices" },
];

export const LINK_MEASURE_HINT = "Only Count is available for link events";

/** Built-in choices in picker order; custom event names follow them. */
export const EVENT_OPTIONS: { event: EventChoice; label: string }[] = [
  { event: { kind: "any" }, label: "Any event" },
  ...EVENT_TYPES.map((t) => ({
    event: { kind: "type", value: t.value } as EventChoice,
    label: t.label,
  })),
  { event: { kind: "link_view" }, label: "Link view (via link)" },
  { event: { kind: "link_install" }, label: "Link-driven install" },
];

const TYPE_BY_VALUE = new Map<string, (typeof EVENT_TYPES)[number]>(
  EVENT_TYPES.map((t) => [t.value, t])
);
const TYPE_BY_COUNTER = new Map<string, EventType>(
  EVENT_TYPES.map((t) => [t.counter, t.value])
);

export function eventKey(e: EventChoice): string {
  return e.kind === "type" || e.kind === "name"
    ? `${e.kind}:${e.value}`
    : e.kind;
}

export function sameEvent(a: EventChoice, b: EventChoice): boolean {
  return eventKey(a) === eventKey(b);
}

export function eventLabel(e: EventChoice): string {
  if (e.kind === "name") return e.value;
  return EVENT_OPTIONS.find((o) => sameEvent(o.event, e))?.label ?? e.kind;
}

const isLinkPreset = (e: EventChoice) =>
  e.kind === "link_view" || e.kind === "link_install";

export function measureAllowed(event: EventChoice, measure: Measure): boolean {
  return measure === "count" || !isLinkPreset(event);
}

export function toMetric(
  event: EventChoice,
  measure: Measure
): { metric: MetricQueryMetric; managedChip?: StoredFilter } {
  if (measure === "count" || isLinkPreset(event)) {
    switch (event.kind) {
      case "any":
        return { metric: "events" };
      case "type":
        return { metric: TYPE_BY_VALUE.get(event.value)!.counter };
      case "link_view":
        return { metric: "link_views" };
      case "link_install":
        return { metric: "link_driven_installs" };
      case "name":
        return {
          metric: "events",
          managedChip: {
            field: "event_name",
            operator: "is",
            value: event.value,
          },
        };
    }
  }
  if (event.kind === "type")
    return {
      metric: measure,
      managedChip: { field: "event_type", operator: "is", value: event.value },
    };
  if (event.kind === "name")
    return {
      metric: measure,
      managedChip: { field: "event_name", operator: "is", value: event.value },
    };
  return { metric: measure };
}

const isScalarIs = (f: StoredFilter, field: string) =>
  f.field === field &&
  f.operator === "is" &&
  typeof f.value === "string" &&
  f.value !== "";

function claim(
  filters: StoredFilter[],
  match: (f: StoredFilter) => boolean
): [StoredFilter | undefined, StoredFilter[]] {
  const i = filters.findIndex(match);
  return i < 0
    ? [undefined, filters]
    : [filters[i], [...filters.slice(0, i), ...filters.slice(i + 1)]];
}

/** Inverse of toMetric: claims at most one managed chip, everything else stays in `rest`. */
export function fromMetric(
  metric: MetricQueryMetric,
  filters: StoredFilter[]
): { event: EventChoice; measure: Measure; rest: StoredFilter[] } {
  const counterType = TYPE_BY_COUNTER.get(metric);
  if (counterType)
    return {
      event: { kind: "type", value: counterType },
      measure: "count",
      rest: filters,
    };
  if (metric === "link_views")
    return { event: { kind: "link_view" }, measure: "count", rest: filters };
  if (metric === "link_driven_installs")
    return { event: { kind: "link_install" }, measure: "count", rest: filters };

  const measure: Measure =
    metric === "unique_visitors" || metric === "unique_devices"
      ? metric
      : "count";
  if (measure !== "count") {
    const [type, rest] = claim(
      filters,
      (f) => isScalarIs(f, "event_type") && TYPE_BY_VALUE.has(f.value)
    );
    if (type)
      return {
        event: { kind: "type", value: type.value as EventType },
        measure,
        rest,
      };
  }
  const [name, rest] = claim(filters, (f) => isScalarIs(f, "event_name"));
  if (name)
    return { event: { kind: "name", value: name.value }, measure, rest };
  return { event: { kind: "any" }, measure, rest: filters };
}

/** "<Measure> of <Event> · by <Dimension> · N filters", counting only the Filter chips. */
export function describeWidget({
  query,
  filters,
}: {
  query: Pick<MetricQuery, "metric" | "group_by">;
  filters: StoredFilter[];
}): string {
  const { event, measure, rest } = fromMetric(query.metric, filters);
  const measureLabel =
    MEASURES.find((m) => m.key === measure)?.label ?? measure;
  const parts = [
    event.kind === "any" && measure === "count"
      ? "Events"
      : `${measureLabel} of ${eventLabel(event)}`,
  ];
  if (query.group_by) {
    parts.push(
      `by ${DIMENSIONS.find((d) => d.key === query.group_by)?.label ?? query.group_by.replace(/^properties\./, "")}`
    );
  }
  if (rest.length)
    parts.push(`${rest.length} filter${rest.length > 1 ? "s" : ""}`);
  return parts.join(" · ");
}
