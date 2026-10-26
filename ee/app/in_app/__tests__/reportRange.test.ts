import { describe, expect, it } from "vitest";
import { reportRange } from "../InAppReportPage";

describe("reportRange", () => {
  it("asks for today as the UTC day, whatever the local day is", () => {
    // 01:30 on the 21st in Bucharest is still the 20th in UTC.
    const now = new Date("2026-09-20T22:30:00Z");
    expect(reportRange(1, now)).toEqual({
      from: "2026-09-20",
      to: "2026-09-20",
      by: "hour",
    });
  });

  it("counts the days back from the UTC day, across a month", () => {
    const now = new Date("2026-10-02T00:10:00Z");
    expect(reportRange(7, now)).toEqual({
      from: "2026-09-26",
      to: "2026-10-02",
      by: "day",
    });
  });
});
