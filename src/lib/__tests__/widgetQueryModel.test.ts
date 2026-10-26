import { describe, it, expect } from "vitest";
import {
  EVENT_OPTIONS,
  MEASURES,
  describeWidget,
  eventLabel,
  fromMetric,
  measureAllowed,
  sameEvent,
  toMetric,
  type EventChoice,
  type Measure,
} from "../widgetQueryModel";

const country = { field: "country", operator: "is" as const, value: "RO" };

describe("toMetric", () => {
  it("maps Count of any event to events", () => {
    expect(toMetric({ kind: "any" }, "count")).toEqual({ metric: "events" });
  });
  it("maps Count of a built-in type to its counter", () => {
    expect(toMetric({ kind: "type", value: "install" }, "count")).toEqual({
      metric: "installs",
    });
    expect(toMetric({ kind: "type", value: "app_open" }, "count")).toEqual({
      metric: "app_opens",
    });
    expect(toMetric({ kind: "type", value: "view" }, "count")).toEqual({
      metric: "views",
    });
    expect(toMetric({ kind: "type", value: "open" }, "count")).toEqual({
      metric: "opens",
    });
    expect(toMetric({ kind: "type", value: "reinstall" }, "count")).toEqual({
      metric: "reinstalls",
    });
    expect(toMetric({ kind: "type", value: "user_referred" }, "count")).toEqual(
      { metric: "referred_users" }
    );
  });
  it("maps the link presets to their link metrics", () => {
    expect(toMetric({ kind: "link_view" }, "count")).toEqual({
      metric: "link_views",
    });
    expect(toMetric({ kind: "link_install" }, "count")).toEqual({
      metric: "link_driven_installs",
    });
  });
  it("maps Count of a custom name to events plus an event_name chip", () => {
    expect(toMetric({ kind: "name", value: "buy" }, "count")).toEqual({
      metric: "events",
      managedChip: { field: "event_name", operator: "is", value: "buy" },
    });
  });
  it("maps uniques to the unique metric, with a managed chip for a type or name", () => {
    expect(toMetric({ kind: "any" }, "unique_visitors")).toEqual({
      metric: "unique_visitors",
    });
    expect(toMetric({ kind: "any" }, "unique_devices")).toEqual({
      metric: "unique_devices",
    });
    expect(
      toMetric({ kind: "type", value: "install" }, "unique_visitors")
    ).toEqual({
      metric: "unique_visitors",
      managedChip: { field: "event_type", operator: "is", value: "install" },
    });
    expect(toMetric({ kind: "name", value: "buy" }, "unique_devices")).toEqual({
      metric: "unique_devices",
      managedChip: { field: "event_name", operator: "is", value: "buy" },
    });
  });
  it("only allows Count for the link presets", () => {
    expect(measureAllowed({ kind: "link_view" }, "unique_visitors")).toBe(
      false
    );
    expect(measureAllowed({ kind: "link_install" }, "unique_devices")).toBe(
      false
    );
    expect(measureAllowed({ kind: "link_view" }, "count")).toBe(true);
    expect(
      measureAllowed({ kind: "type", value: "install" }, "unique_visitors")
    ).toBe(true);
    // A disallowed pair falls back to Count rather than inventing a metric.
    expect(toMetric({ kind: "link_view" }, "unique_visitors")).toEqual({
      metric: "link_views",
    });
  });
});

describe("fromMetric", () => {
  const cases: [EventChoice, Measure][] = [
    [{ kind: "any" }, "count"],
    [{ kind: "type", value: "install" }, "count"],
    [{ kind: "type", value: "user_referred" }, "count"],
    [{ kind: "name", value: "buy" }, "count"],
    [{ kind: "type", value: "app_open" }, "unique_visitors"],
    [{ kind: "name", value: "buy" }, "unique_devices"],
    [{ kind: "any" }, "unique_devices"],
    [{ kind: "link_view" }, "count"],
    [{ kind: "link_install" }, "count"],
  ];
  it.each(cases)(
    "round-trips %j × %s with other chips kept in rest",
    (event, measure) => {
      const { metric, managedChip } = toMetric(event, measure);
      const filters = [country, ...(managedChip ? [managedChip] : [])];
      expect(fromMetric(metric, filters)).toEqual({
        event,
        measure,
        rest: [country],
      });
    }
  );

  it("leaves chips alone for counter metrics", () => {
    expect(fromMetric("installs", [country])).toEqual({
      event: { kind: "type", value: "install" },
      measure: "count",
      rest: [country],
    });
    const name = { field: "event_name", operator: "is" as const, value: "buy" };
    expect(fromMetric("installs", [name]).rest).toEqual([name]);
  });

  it("claims at most one managed chip and ignores non-`is` or unknown types", () => {
    const a = { field: "event_name", operator: "is" as const, value: "a" };
    const b = { field: "event_name", operator: "is" as const, value: "b" };
    expect(fromMetric("events", [a, b])).toEqual({
      event: { kind: "name", value: "a" },
      measure: "count",
      rest: [b],
    });
    const not = {
      field: "event_name",
      operator: "is_not" as const,
      value: "a",
    };
    expect(fromMetric("events", [not])).toEqual({
      event: { kind: "any" },
      measure: "count",
      rest: [not],
    });
    const weird = {
      field: "event_type",
      operator: "is" as const,
      value: "purchase",
    };
    expect(fromMetric("unique_visitors", [weird])).toEqual({
      event: { kind: "any" },
      measure: "unique_visitors",
      rest: [weird],
    });
    // events never claims an event_type chip: Count of a type is its counter.
    const type = {
      field: "event_type",
      operator: "is" as const,
      value: "install",
    };
    expect(fromMetric("events", [type]).rest).toEqual([type]);
  });
});

describe("options", () => {
  it("lists the built-ins, link presets and measures", () => {
    expect(EVENT_OPTIONS.map((o) => o.label)).toEqual([
      "Any event",
      "Install",
      "App open",
      "Link view",
      "Link open",
      "Reinstall",
      "Referred user",
      "Link view (via link)",
      "Link-driven install",
    ]);
    expect(MEASURES.map((m) => m.label)).toEqual([
      "Count",
      "Unique visitors",
      "Unique devices",
    ]);
    expect(eventLabel({ kind: "name", value: "buy" })).toBe("buy");
    expect(
      sameEvent(
        { kind: "type", value: "view" },
        { kind: "type", value: "view" }
      )
    ).toBe(true);
    expect(
      sameEvent({ kind: "type", value: "view" }, { kind: "link_view" })
    ).toBe(false);
  });
});

describe("describeWidget", () => {
  const country = { field: "country", operator: "is" as const, value: "RO" };
  it("names Measure of Event, the dimension and only the Filter chips", () => {
    expect(describeWidget({ query: { metric: "events" }, filters: [] })).toBe(
      "Events"
    );
    expect(
      describeWidget({
        query: { metric: "installs", group_by: "country" },
        filters: [],
      })
    ).toBe("Count of Install · by Country");
    expect(
      describeWidget({
        query: { metric: "events", group_by: "properties.plan" },
        filters: [
          { field: "event_name", operator: "is", value: "buy" },
          country,
        ],
      })
    ).toBe("Count of buy · by plan · 1 filter");
    expect(
      describeWidget({
        query: { metric: "unique_visitors" },
        filters: [
          country,
          { field: "event_type", operator: "is", value: "install" },
          { ...country, value: "DE" },
        ],
      })
    ).toBe("Unique visitors of Install · 2 filters");
  });
});
