import { describe, it, expect } from "vitest";
import { newUsersSeries, toTrendChartPoints } from "../trendPoints";

describe("toTrendChartPoints", () => {
  it("maps new users, previous users and revenue in dollars", () => {
    expect(
      toTrendChartPoints([
        {
          date: "2026-09-01",
          new_users: 4,
          previous_new_users: 2,
          revenue_usd_cents: 1250,
        },
        { date: "2026-09-02", new_users: 0, previous_new_users: 1 },
      ])
    ).toEqual([
      { date: "2026-09-01", users: 4, previousUsers: 2, revenue: 12.5 },
      { date: "2026-09-02", users: 0, previousUsers: 1, revenue: undefined },
    ]);
  });

  it("falls back to the legacy users fields", () => {
    const legacy = { date: "2026-09-01", users: 3, previous_users: 5 } as never;
    expect(toTrendChartPoints([legacy])).toEqual([
      { date: "2026-09-01", users: 3, previousUsers: 5, revenue: undefined },
    ]);
  });
});

describe("newUsersSeries", () => {
  it("feeds the chart value and previous", () => {
    expect(
      newUsersSeries([{ date: "2026-09-01", users: 4, previousUsers: 2 }])
    ).toEqual([{ date: "2026-09-01", value: 4, previous: 2 }]);
  });
});
