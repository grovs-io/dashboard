import { describe, it, expect } from "vitest";
import {
  DIMENSIONS,
  QUERY_METRICS,
  toMetricQueryParams,
  bucketLabel,
  metricForCard,
  filterFieldFor,
  isRawMetricQuery,
  metricQueryMaxDays,
  metricQueryBlockReason,
} from "../metricQuery";

describe("metricQuery helpers", () => {
  it("serialises a query onto the base date params", () => {
    const p = toMetricQueryParams(
      {
        start_date: "2026-09-01",
        end_date: "2026-09-30",
        platform: "ios",
        filters: "[]",
      },
      {
        metric: "installs",
        group_by: "country",
        granularity: "week",
        limit: 5,
        compare: true,
      }
    );
    expect(p).toEqual({
      start_date: "2026-09-01",
      end_date: "2026-09-30",
      platform: "ios",
      filters: "[]",
      metric: "installs",
      group_by: "country",
      granularity: "week",
      limit: 5,
      compare: "true",
    });
  });

  it("omits optional fields that are unset", () => {
    const p = toMetricQueryParams(
      { start_date: "2026-09-01" },
      { metric: "views" }
    );
    expect(p).toEqual({ start_date: "2026-09-01", metric: "views" });
  });

  it("labels countries, platforms and empty keys", () => {
    expect(bucketLabel("country", { key: "RO", label: "RO", value: 1 })).toBe(
      "Romania"
    );
    expect(
      bucketLabel("platform", { key: "ios", label: "ios", value: 1 })
    ).toBe("iOS");
    expect(bucketLabel("city", { key: "", label: "(none)", value: 1 })).toBe(
      "(none)"
    );
    expect(
      bucketLabel("link_id", { key: "7", label: "Summer promo", value: 1 })
    ).toBe("Summer promo");
  });

  it("maps overview cards to query metrics with installs as the fallback", () => {
    expect(metricForCard("app_opens")).toBe("app_opens");
    expect(metricForCard("link_views")).toBe("link_views");
    expect(metricForCard("new_users")).toBe("installs");
    expect(metricForCard("revenue")).toBe("installs");
    expect(metricForCard("organic_installs")).toBe("installs");
  });

  it("maps dimensions to Explorer filter fields", () => {
    expect(filterFieldFor("properties.plan")).toBe("plan");
    expect(filterFieldFor("user.tier")).toBe("user.tier");
    expect(filterFieldFor("country")).toBe("country");
  });

  it("catalogues are non-empty and unique", () => {
    expect(new Set(DIMENSIONS.map((d) => d.key)).size).toBe(DIMENSIONS.length);
    expect(DIMENSIONS.map((d) => d.key)).toContain("source");
    expect(QUERY_METRICS.map((m) => m.key)).toContain("unique_visitors");
    expect(QUERY_METRICS[0]).toEqual({
      key: "events",
      label: "Events (all, incl. purchases)",
    });
  });

  const limits = {
    rangeSpanDays: 182,
    from: new Date("2026-03-26"),
    prevFrom: new Date("2025-09-25"),
  };
  it("isRawMetricQuery mirrors the backend rollup coverage", () => {
    expect(
      isRawMetricQuery({ metric: "installs", group_by: "country" }, [])
    ).toBe(false);
    expect(isRawMetricQuery({ metric: "installs", group_by: "city" }, [])).toBe(
      true
    );
    expect(
      isRawMetricQuery({ metric: "installs", group_by: "app_version" }, [])
    ).toBe(true);
    expect(
      isRawMetricQuery(
        { metric: "unique_visitors", group_by: "app_version" },
        []
      )
    ).toBe(false);
    expect(
      isRawMetricQuery({ metric: "unique_devices", group_by: "country" }, [])
    ).toBe(true);
    expect(
      isRawMetricQuery({ metric: "link_views", group_by: "country" }, [])
    ).toBe(true);
    expect(isRawMetricQuery({ metric: "events" }, [])).toBe(true);
    expect(
      isRawMetricQuery({ metric: "installs" }, [
        { field: "platform", operator: "is", value: "ios" },
      ])
    ).toBe(false);
    expect(
      isRawMetricQuery({ metric: "installs" }, [
        { field: "country", operator: "is", value: "RO" },
      ])
    ).toBe(true);
  });
  it("isRawMetricQuery covers the remaining rollup edges", () => {
    expect(
      isRawMetricQuery({ metric: "installs", group_by: "properties.plan" }, [])
    ).toBe(false);
    expect(
      isRawMetricQuery({ metric: "installs", group_by: "properties.color" }, [])
    ).toBe(true);
    expect(
      isRawMetricQuery({ metric: "unique_devices", group_by: "platform" }, [])
    ).toBe(false);
    expect(isRawMetricQuery({ metric: "unique_devices" }, [])).toBe(false);
    expect(isRawMetricQuery({ metric: "installs", group_by: "" }, [])).toBe(
      false
    );
    expect(
      isRawMetricQuery({ metric: "installs" }, [
        { field: "platform", operator: "is", value: ["ios", "android"] },
      ])
    ).toBe(true);
    expect(
      isRawMetricQuery({ metric: "installs" }, [
        { field: "platform", operator: "is_not", value: "ios" },
      ])
    ).toBe(true);
    expect(
      isRawMetricQuery({ metric: "installs" }, [
        { field: "platform", operator: "is", value: "ios" },
        { field: "platform", operator: "is", value: "android" },
      ])
    ).toBe(true);
  });
  it("metricQueryMaxDays gives counters the long cap unless a heavy chip is present", () => {
    expect(
      metricQueryMaxDays({ metric: "installs", group_by: "city" }, [])
    ).toBe(366);
    expect(
      metricQueryMaxDays({ metric: "unique_visitors", group_by: "city" }, [])
    ).toBe(90);
    expect(
      metricQueryMaxDays({ metric: "installs", group_by: "city" }, [
        { field: "event_name", operator: "is_not", value: "buy" },
      ])
    ).toBe(90);
    expect(
      metricQueryMaxDays({ metric: "installs", group_by: "city" }, [], {
        plan: "free",
        queryable_days: 365,
        cold_after_days: 365,
        can_query_cold: false,
        raw_max_days: 30,
        raw_counter_max_days: 120,
      })
    ).toBe(120);
  });
  it("metricQueryBlockReason blocks only what the backend would reject", () => {
    expect(
      metricQueryBlockReason(
        { metric: "installs", group_by: "country" },
        [],
        limits
      )
    ).toBeUndefined();
    expect(
      metricQueryBlockReason(
        { metric: "installs", group_by: "city" },
        [],
        limits
      )
    ).toBeUndefined();
    expect(
      metricQueryBlockReason(
        { metric: "unique_visitors", group_by: "city" },
        [],
        limits
      )
    ).toMatch(/limited to 90 days/);
    expect(
      metricQueryBlockReason({ metric: "installs", group_by: "city" }, [], {
        ...limits,
        rangeSpanDays: 400,
      })
    ).toMatch(/limited to 366 days/);
  });
  it("metricQueryBlockReason mentions filters only when there are some", () => {
    const chips = [{ field: "country", operator: "is", value: "RO" }];
    expect(
      metricQueryBlockReason(
        { metric: "unique_visitors", group_by: "city" },
        [],
        limits
      )
    ).toBe(
      "This query reads raw events and is limited to 90 days. Narrow the date range."
    );
    expect(
      metricQueryBlockReason({ metric: "unique_visitors" }, chips, limits)
    ).toBe(
      "This query reads raw events and is limited to 90 days. Narrow the date range or remove filters."
    );
  });
  it("metricQueryBlockReason holds heavy chips that reach cold data, judging compare on the previous period", () => {
    const retention = {
      plan: "paid" as const,
      queryable_days: 3650,
      cold_after_days: 60,
      can_query_cold: true,
    };
    const now = new Date();
    const day = 86_400_000;
    const recent = {
      rangeSpanDays: 30,
      retention,
      from: new Date(now.getTime() - 30 * day),
      prevFrom: new Date(now.getTime() - 61 * day),
    };
    const heavy = [{ field: "event_name", operator: "contains", value: "buy" }];
    expect(
      metricQueryBlockReason({ metric: "installs" }, heavy, recent)
    ).toBeUndefined();
    expect(
      metricQueryBlockReason(
        { metric: "installs", compare: true },
        heavy,
        recent
      )
    ).toMatch(/can't reach older data/);
  });
});
