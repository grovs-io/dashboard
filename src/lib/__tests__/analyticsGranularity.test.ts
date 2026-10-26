import { describe, it, expect } from "vitest";
import {
  chooseGranularity,
  defaultGranularity,
  isGranularity,
  snapRangeToGranularity,
} from "../analyticsGranularity";

describe("analyticsGranularity", () => {
  it("defaults to day for ranges up to ~3 months", () => {
    expect(
      defaultGranularity(new Date("2026-07-01"), new Date("2026-09-30"))
    ).toBe("day");
  });
  it("defaults to week up to a year", () => {
    expect(
      defaultGranularity(new Date("2026-01-01"), new Date("2026-06-30"))
    ).toBe("week");
  });
  it("defaults to month beyond a year", () => {
    expect(
      defaultGranularity(new Date("2024-01-01"), new Date("2026-06-30"))
    ).toBe("month");
  });
  it("defaults to day when the range is open", () => {
    expect(defaultGranularity(undefined, undefined)).toBe("day");
  });
  it("isGranularity narrows strings", () => {
    expect(isGranularity("week")).toBe(true);
    expect(isGranularity("hour")).toBe(false);
  });
});

describe("snapRangeToGranularity", () => {
  const now = new Date("2026-09-25T12:00:00");
  const range = {
    from: new Date("2026-08-26T00:00:00"),
    to: new Date("2026-09-25T23:59:59.999"),
  };
  it("leaves day ranges alone", () => {
    expect(snapRangeToGranularity(range, "day", now)).toEqual(range);
  });
  it("snaps weeks to Monday..Sunday but never past today", () => {
    const r = snapRangeToGranularity(range, "week", now);
    expect(r.from).toEqual(new Date("2026-08-24T00:00:00"));
    expect(r.to).toEqual(new Date("2026-09-25T23:59:59.999"));
  });
  it("snaps months to whole months but never past today", () => {
    const r = snapRangeToGranularity(range, "month", now);
    expect(r.from).toEqual(new Date("2026-08-01T00:00:00"));
    expect(r.to).toEqual(new Date("2026-09-25T23:59:59.999"));
  });
  it("month snapping extends a mid-month end when it is in the past", () => {
    const r = snapRangeToGranularity(
      {
        from: new Date("2026-05-10T00:00:00"),
        to: new Date("2026-06-12T00:00:00"),
      },
      "month",
      now
    );
    expect(r.from).toEqual(new Date("2026-05-01T00:00:00"));
    expect(r.to).toEqual(new Date("2026-06-30T23:59:59.999"));
  });
  it("never snaps from before minDate", () => {
    const minDate = new Date("2026-08-15T00:00:00");
    const r = snapRangeToGranularity(
      { from: minDate, to: range.to },
      "month",
      now,
      minDate
    );
    expect(r.from).toEqual(minDate);
    expect(
      snapRangeToGranularity(
        { from: minDate, to: range.to },
        "week",
        now,
        minDate
      ).from
    ).toEqual(minDate);
  });
});

describe("chooseGranularity", () => {
  const now = new Date("2026-09-25T12:00:00");
  it("stores the explicit choice when snapping moves the range past a default boundary", () => {
    // 365 days defaults to week; snapping to whole weeks grows it to 371 days, whose default is month.
    const lastYear = {
      from: new Date("2024-12-31T00:00:00"),
      to: new Date("2025-12-31T23:59:59.999"),
    };
    const r = chooseGranularity("week", lastYear, now);
    expect(r.param).toBe("week");
    expect(r.range).toEqual({
      from: new Date("2024-12-30T00:00:00"),
      to: new Date("2026-01-04T23:59:59.999"),
    });
  });
  it("stores auto when the choice matches the snapped range's default", () => {
    const month = {
      from: new Date("2026-09-03T00:00:00"),
      to: new Date("2026-09-20T23:59:59.999"),
    };
    expect(chooseGranularity("day", month, now)).toEqual({
      range: month,
      param: "auto",
    });
  });
  it("clamps the snapped start to minDate", () => {
    const minDate = new Date("2025-09-25T00:00:00");
    const r = chooseGranularity(
      "month",
      { from: minDate, to: new Date("2026-09-25T23:59:59.999") },
      now,
      minDate
    );
    expect(r.range?.from).toEqual(minDate);
  });
  it("leaves an undefined range alone", () => {
    expect(chooseGranularity("week", undefined, now)).toEqual({
      range: undefined,
      param: "week",
    });
  });
});
