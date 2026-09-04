import { describe, it, expect } from "vitest";
import { startOfDay, sub, differenceInCalendarDays } from "date-fns";
import { ApiError } from "../ApiError";
import {
  VOLUME_MAX_DAYS,
  retentionMinDate,
  retentionColdBefore,
  clampVolumeStart,
  isHeavyQueryShape,
  heavyShapeHitsCold,
  getAnalyticsErrorInfo,
  ANALYTICS_ERROR_CODES,
} from "../analyticsLimits";
import type { AnalyticsRetention } from "@/types";

const NOW = new Date("2026-06-26T12:00:00.000Z");

const free: AnalyticsRetention = {
  plan: "free",
  queryable_days: 365,
  cold_after_days: 365,
  can_query_cold: false,
};
const paid: AnalyticsRetention = {
  plan: "paid",
  queryable_days: 730,
  cold_after_days: 365,
  can_query_cold: false,
};

describe("retentionMinDate / retentionColdBefore", () => {
  it("returns undefined when retention is unknown (unbounded)", () => {
    expect(retentionMinDate(undefined, NOW)).toBeUndefined();
    expect(retentionColdBefore(undefined, NOW)).toBeUndefined();
  });

  it("computes the oldest queryable day from queryable_days", () => {
    const min = retentionMinDate(paid, NOW)!;
    expect(differenceInCalendarDays(NOW, min)).toBe(730);
    expect(min.getTime()).toBe(startOfDay(sub(NOW, { days: 730 })).getTime());
  });

  it("computes the cold boundary from cold_after_days", () => {
    expect(differenceInCalendarDays(NOW, retentionColdBefore(paid, NOW)!)).toBe(
      365
    );
  });
});

describe("clampVolumeStart", () => {
  it("floors the start to the 90-day aggregate cap", () => {
    const old = sub(NOW, { days: 200 });
    const clamped = clampVolumeStart(old, NOW);
    expect(differenceInCalendarDays(NOW, clamped)).toBe(VOLUME_MAX_DAYS);
  });

  it("leaves a recent start untouched", () => {
    const recent = sub(NOW, { days: 10 });
    expect(clampVolumeStart(recent, NOW)).toBe(recent);
  });
});

describe("isHeavyQueryShape", () => {
  it("is heavy on free-text search", () => {
    expect(isHeavyQueryShape("foo", [])).toBe(true);
    expect(isHeavyQueryShape("   ", [])).toBe(false);
    expect(isHeavyQueryShape("", [])).toBe(false);
  });

  it("is heavy on contains / is_not / not_contains operators", () => {
    expect(isHeavyQueryShape("", [{ operator: "contains" }])).toBe(true);
    expect(isHeavyQueryShape("", [{ operator: "is_not" }])).toBe(true);
    expect(isHeavyQueryShape("", [{ operator: "not_contains" }])).toBe(true);
  });

  it("is light on plain `is` equality filters", () => {
    expect(isHeavyQueryShape("", [{ operator: "is" }])).toBe(false);
  });
});

describe("heavyShapeHitsCold", () => {
  it("warns when a heavy query reaches the cold window without cold access", () => {
    const coldStart = sub(NOW, { days: 400 }); // older than 365d cold boundary
    expect(heavyShapeHitsCold(paid, coldStart, true, NOW)).toBe(true);
  });

  it("does not warn for a non-heavy query, even in cold range", () => {
    expect(heavyShapeHitsCold(paid, sub(NOW, { days: 400 }), false, NOW)).toBe(
      false
    );
  });

  it("does not warn inside the warm window", () => {
    expect(heavyShapeHitsCold(paid, sub(NOW, { days: 100 }), true, NOW)).toBe(
      false
    );
  });

  it("does not warn when the plan can query cold", () => {
    const enterprise: AnalyticsRetention = { ...paid, can_query_cold: true };
    expect(
      heavyShapeHitsCold(enterprise, sub(NOW, { days: 400 }), true, NOW)
    ).toBe(false);
  });

  it("does not warn without retention info", () => {
    expect(
      heavyShapeHitsCold(undefined, sub(NOW, { days: 400 }), true, NOW)
    ).toBe(false);
  });
});

describe("getAnalyticsErrorInfo", () => {
  it("flags retention_window_exceeded as a retention error", () => {
    const err = new ApiError(
      "nope",
      400,
      ANALYTICS_ERROR_CODES.retentionWindowExceeded,
      {
        error: "range exceeds plan",
      }
    );
    const info = getAnalyticsErrorInfo(err);
    expect(info.isRetention).toBe(true);
    expect(info.isHeavy).toBe(false);
    expect(info.description).toBe("range exceeds plan");
  });

  it("flags query_too_heavy as a heavy error", () => {
    const err = new ApiError("nope", 422, ANALYTICS_ERROR_CODES.queryTooHeavy);
    const info = getAnalyticsErrorInfo(err);
    expect(info.isHeavy).toBe(true);
    expect(info.isRetention).toBe(false);
  });

  it("falls back to a generic message for unknown errors", () => {
    const info = getAnalyticsErrorInfo(new ApiError("x", 500));
    expect(info.isRetention).toBe(false);
    expect(info.isHeavy).toBe(false);
    expect(info.title).toBe("Couldn't load analytics");
  });

  it("free plan: heavy query never reaches cold (queryable == cold)", () => {
    // Free can't reach past 365d at all, so a heavy query at the limit isn't cold.
    expect(heavyShapeHitsCold(free, sub(NOW, { days: 364 }), true, NOW)).toBe(
      false
    );
  });
});
