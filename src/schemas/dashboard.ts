import { z } from "zod";
import {
  EVENT_TYPES,
  fromMetric,
  measureAllowed,
  toMetric,
  type EventType,
} from "@/lib/widgetQueryModel";
import type {
  AnalyticsGranularity,
  DashboardWidget,
  MetricQueryMetric,
  PanelKey,
  StoredFilter,
  WidgetPayload,
} from "@/types";

const PANEL_KEYS = [
  "acquisition_channels",
  "top_links",
  "top_campaigns",
  "acquisition",
  "engagement",
  "revenue",
  "retention",
  "user_trends",
  "kpis_acquisition",
  "kpis_engagement",
  "kpis_revenue",
  "kpis_links",
  "revenue_trend",
] as const satisfies readonly PanelKey[];
const TYPE_VALUES = EVENT_TYPES.map((t) => t.value) as [
  EventType,
  ...EventType[],
];

const eventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("any") }),
  z.object({ kind: z.literal("type"), value: z.enum(TYPE_VALUES) }),
  z.object({ kind: z.literal("link_view") }),
  z.object({ kind: z.literal("link_install") }),
  z.object({ kind: z.literal("name"), value: z.string().min(1) }),
]);

const LIMIT_MESSAGE = "Enter a number from 1 to 50";

export const widgetFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(100, "Keep it under 100 characters"),
    kind: z.enum(["metric", "panel"]),
    panel: z.enum(PANEL_KEYS).optional(),
    event: eventSchema,
    measure: z.enum(["count", "unique_visitors", "unique_devices"]),
    group_by: z.string().max(200),
    viz: z.enum(["number", "bar", "line", "table"]),
    size: z.enum(["sm", "md", "lg"]),
    compare: z.boolean(),
    // Checked in superRefine: a stale Top value from metric mode must not block a panel.
    limit: z.custom<number>((v) => typeof v === "number"),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "panel" && !v.panel)
      ctx.addIssue({
        code: "custom",
        path: ["panel"],
        message: "Pick a panel",
      });
    if (
      v.kind === "metric" &&
      !(Number.isInteger(v.limit) && v.limit >= 1 && v.limit <= 50)
    ) {
      ctx.addIssue({ code: "custom", path: ["limit"], message: LIMIT_MESSAGE });
    }
    if (v.kind === "metric" && !measureAllowed(v.event, v.measure)) {
      ctx.addIssue({
        code: "custom",
        path: ["measure"],
        message: "Only Count is available for link events",
      });
    }
  });
export type WidgetFormValues = z.infer<typeof widgetFormSchema>;

/** What callers may prefill: form fields, plus a metric that seeds Event × Measure. */
export type WidgetInitial = Partial<
  Omit<WidgetFormValues, "event" | "measure">
> & { metric?: MetricQueryMetric };

export const dashboardNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Keep it under 100 characters"),
});
export type DashboardNameValues = z.infer<typeof dashboardNameSchema>;

export const DEFAULT_WIDGET_FORM: WidgetFormValues = {
  title: "",
  kind: "metric",
  event: { kind: "type", value: "install" },
  measure: "count",
  group_by: "country",
  viz: "bar",
  size: "md",
  compare: false,
  limit: 10,
};

/** A metric widget prepends its managed Event chip; line widgets keep their build granularity. */
export function widgetFormToPayload(
  values: WidgetFormValues,
  filters: StoredFilter[],
  granularity: AnalyticsGranularity
): WidgetPayload {
  const common = {
    title: values.title.trim(),
    viz: values.viz,
    size: values.size,
  };
  if (values.kind === "panel" && values.panel) {
    return {
      ...common,
      kind: "panel",
      panel: values.panel,
      query: {},
      filters,
    };
  }
  const { metric, managedChip } = toMetric(values.event, values.measure);
  const groupBy = values.viz === "number" ? "" : values.group_by;
  return {
    ...common,
    kind: "metric",
    panel: null,
    query: {
      metric,
      ...(groupBy ? { group_by: groupBy } : {}),
      limit: values.limit,
      compare: values.viz === "line" ? false : values.compare,
      ...(values.viz === "line" ? { granularity } : {}),
    },
    filters: managedChip ? [managedChip, ...filters] : filters,
  };
}

/** Metric payloads give their Event chip back to the picker. */
function payloadToForm(payload: WidgetPayload): {
  values: WidgetFormValues;
  chips: StoredFilter[];
} {
  const common = { title: payload.title, viz: payload.viz, size: payload.size };
  if (payload.kind === "panel") {
    return {
      values: {
        ...DEFAULT_WIDGET_FORM,
        ...common,
        kind: "panel",
        panel: payload.panel,
      },
      chips: payload.filters,
    };
  }
  const { event, measure, rest } = fromMetric(
    payload.query.metric,
    payload.filters
  );
  return {
    values: {
      ...common,
      kind: "metric",
      event,
      measure,
      group_by: payload.query.group_by ?? "",
      compare: !!payload.query.compare,
      limit: payload.query.limit ?? 10,
    },
    chips: rest,
  };
}

/** The form half of a stored widget; `widgetFilterChips` gives the Filter chips. */
export function widgetToFormValues(widget: DashboardWidget): WidgetFormValues {
  return payloadToForm(widget).values;
}

/** A preset's chips replace the current ones. */
export function presetToFormValues(template: { payload: WidgetPayload }): {
  values: WidgetFormValues;
  chips: StoredFilter[];
} {
  return payloadToForm(template.payload);
}

/** The chips shown under Filter: all of them for panels, the unclaimed ones for metrics. */
export function widgetFilterChips(widget: DashboardWidget): StoredFilter[] {
  return widget.kind === "panel"
    ? widget.filters
    : fromMetric(widget.query.metric, widget.filters).rest;
}
