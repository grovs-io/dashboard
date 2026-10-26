import { describe, it, expect } from "vitest";
import {
  widgetFormSchema,
  dashboardNameSchema,
  presetToFormValues,
  widgetFormToPayload,
  widgetToFormValues,
  type WidgetFormValues,
} from "../dashboard";
import { WIDGET_TEMPLATES } from "@/components/dashboards/widgetTemplates";

const valid: WidgetFormValues = {
  title: "Installs by country",
  kind: "metric",
  event: { kind: "type", value: "install" },
  measure: "count",
  group_by: "country",
  viz: "bar",
  size: "md",
  compare: false,
  limit: 10,
};
const meta = {
  id: 1,
  dashboard_id: 1,
  position: 0,
  created_at: "",
  updated_at: "",
};

describe("widgetFormSchema", () => {
  it("accepts a valid form", () => {
    expect(widgetFormSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects empty or long titles, bad enums and out-of-range limits", () => {
    expect(widgetFormSchema.safeParse({ ...valid, title: "" }).success).toBe(
      false
    );
    expect(
      widgetFormSchema.safeParse({ ...valid, title: "x".repeat(101) }).success
    ).toBe(false);
    expect(
      widgetFormSchema.safeParse({ ...valid, measure: "revenue" }).success
    ).toBe(false);
    expect(
      widgetFormSchema.safeParse({
        ...valid,
        event: { kind: "type", value: "purchase" },
      }).success
    ).toBe(false);
    expect(widgetFormSchema.safeParse({ ...valid, viz: "pie" }).success).toBe(
      false
    );
    expect(widgetFormSchema.safeParse({ ...valid, limit: 0 }).success).toBe(
      false
    );
    expect(widgetFormSchema.safeParse({ ...valid, limit: 51 }).success).toBe(
      false
    );
  });
  it("needs a panel in panel mode and rejects uniques on link presets", () => {
    expect(
      widgetFormSchema.safeParse({ ...valid, kind: "panel" }).success
    ).toBe(false);
    expect(
      widgetFormSchema.safeParse({
        ...valid,
        kind: "panel",
        panel: "retention",
      }).success
    ).toBe(true);
    expect(
      widgetFormSchema.safeParse({
        ...valid,
        kind: "panel",
        panel: "user_trends",
      }).success
    ).toBe(true);
    // A stale Top value from metric mode never blocks a panel.
    expect(
      widgetFormSchema.safeParse({
        ...valid,
        kind: "panel",
        panel: "retention",
        limit: Number.NaN,
      }).success
    ).toBe(true);
    expect(
      widgetFormSchema.safeParse({
        ...valid,
        kind: "panel",
        panel: "retention",
        limit: 0,
      }).success
    ).toBe(true);
    expect(
      widgetFormSchema.safeParse({ ...valid, limit: Number.NaN }).success
    ).toBe(false);
    expect(widgetFormSchema.safeParse({ ...valid, limit: 2.5 }).success).toBe(
      false
    );
    expect(
      widgetFormSchema.safeParse({
        ...valid,
        event: { kind: "link_view" },
        measure: "unique_visitors",
      }).success
    ).toBe(false);
  });
});

describe("widgetFormToPayload", () => {
  it("omits an empty group_by and stores granularity only for line widgets", () => {
    const bar = widgetFormToPayload({ ...valid, group_by: "" }, [], "week");
    expect(bar.query).toEqual({
      metric: "installs",
      limit: 10,
      compare: false,
    });
    const line = widgetFormToPayload({ ...valid, viz: "line" }, [], "week");
    expect(line.query).toEqual({
      metric: "installs",
      group_by: "country",
      limit: 10,
      compare: false,
      granularity: "week",
    });
  });
  it("never stores compare on a line widget", () => {
    expect(
      widgetFormToPayload({ ...valid, viz: "line", compare: true }, [], "day")
        .query
    ).toMatchObject({ compare: false });
    expect(
      widgetFormToPayload({ ...valid, viz: "bar", compare: true }, [], "day")
        .query
    ).toMatchObject({ compare: true });
  });
  it("puts the managed chip first, and a number widget never groups", () => {
    const country = { field: "country", operator: "is" as const, value: "RO" };
    const p = widgetFormToPayload(
      {
        ...valid,
        event: { kind: "name", value: "buy" },
        viz: "number",
        compare: true,
      },
      [country],
      "day"
    );
    expect(p).toEqual({
      title: "Installs by country",
      kind: "metric",
      panel: null,
      viz: "number",
      size: "md",
      query: { metric: "events", limit: 10, compare: true },
      filters: [{ field: "event_name", operator: "is", value: "buy" }, country],
    });
  });
  it("builds a panel payload with an empty query", () => {
    expect(
      widgetFormToPayload(
        { ...valid, kind: "panel", panel: "top_links", size: "sm" },
        [],
        "day"
      )
    ).toEqual({
      title: "Installs by country",
      kind: "panel",
      panel: "top_links",
      viz: "bar",
      size: "sm",
      query: {},
      filters: [],
    });
  });
});

describe("widgetToFormValues", () => {
  it("round-trips a stored metric widget, claiming its event chip", () => {
    const v = widgetToFormValues({
      ...meta,
      title: "T",
      kind: "metric",
      panel: null,
      viz: "table",
      size: "lg",
      filters: [{ field: "event_type", operator: "is", value: "app_open" }],
      query: {
        metric: "unique_devices",
        group_by: "os",
        limit: 5,
        compare: true,
      },
    });
    expect(v).toEqual({
      title: "T",
      kind: "metric",
      event: { kind: "type", value: "app_open" },
      measure: "unique_devices",
      group_by: "os",
      viz: "table",
      size: "lg",
      compare: true,
      limit: 5,
    });
  });
  it("reads a panel widget, and treats a widget without kind as a metric", () => {
    expect(
      widgetToFormValues({
        ...meta,
        title: "R",
        kind: "panel",
        panel: "retention",
        viz: "bar",
        size: "sm",
        filters: [],
        query: {},
      })
    ).toMatchObject({ kind: "panel", panel: "retention", size: "sm" });
    const legacy = {
      ...meta,
      title: "L",
      viz: "bar",
      size: "md",
      filters: [],
      query: { metric: "opens" },
    } as never;
    expect(widgetToFormValues(legacy)).toMatchObject({
      kind: "metric",
      event: { kind: "type", value: "open" },
      measure: "count",
    });
  });
});

describe("presetToFormValues", () => {
  const byKey = (key: string) => WIDGET_TEMPLATES.find((t) => t.key === key)!;
  it("opens a template in the Metric builder", () => {
    expect(presetToFormValues(byKey("installs-by-country"))).toEqual({
      values: {
        title: "Installs by country",
        kind: "metric",
        event: { kind: "type", value: "install" },
        measure: "count",
        group_by: "country",
        viz: "bar",
        size: "md",
        compare: false,
        limit: 10,
      },
      chips: [],
    });
    expect(presetToFormValues(byKey("unique-visitors")).values).toMatchObject({
      event: { kind: "any" },
      measure: "unique_visitors",
      group_by: "",
      viz: "number",
      size: "sm",
      compare: true,
    });
    expect(presetToFormValues(byKey("top-links")).values).toMatchObject({
      event: { kind: "link_install" },
      measure: "count",
      group_by: "link_id",
      viz: "table",
    });
    expect(presetToFormValues(byKey("events-by-name")).values).toMatchObject({
      event: { kind: "any" },
      group_by: "event_name",
    });
  });
  it("gives an Event chip back to the picker and the rest to Filter", () => {
    const template = {
      payload: {
        kind: "metric" as const,
        panel: null,
        title: "Buyers",
        viz: "bar" as const,
        size: "md" as const,
        query: { metric: "unique_devices" as const },
        filters: [
          { field: "event_name", operator: "is" as const, value: "buy" },
          { field: "country", operator: "is" as const, value: "RO" },
        ],
      },
    };
    expect(presetToFormValues(template)).toMatchObject({
      values: {
        event: { kind: "name", value: "buy" },
        measure: "unique_devices",
      },
      chips: [{ field: "country", operator: "is", value: "RO" }],
    });
  });
});

describe("dashboardNameSchema", () => {
  it("requires 1..100 chars", () => {
    expect(dashboardNameSchema.safeParse({ name: "" }).success).toBe(false);
    expect(dashboardNameSchema.safeParse({ name: "Growth" }).success).toBe(
      true
    );
  });
});
