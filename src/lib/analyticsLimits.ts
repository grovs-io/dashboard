import { startOfDay, sub } from "date-fns";
import { getApiErrorCode, getApiErrorMessage } from "./apiErrorHelpers";
import type { AnalyticsRetention } from "@/types";

/**
 * Aggregate endpoints (events/volume timeline + events total-count) are capped
 * at 90 days regardless of plan. The raw event list may reach further (up to
 * the plan's queryable_days), so this cap is applied per-query, not on the
 * shared date picker.
 */
export const VOLUME_MAX_DAYS = 90;

export const ANALYTICS_ERROR_CODES = {
  retentionWindowExceeded: "retention_window_exceeded",
  queryTooHeavy: "query_too_heavy",
} as const;

// ─── Retention window math ────────────────────────────────────────────────

/**
 * Oldest date the current plan can query. `undefined` when retention is unknown
 * (older backend / self-hosted) — callers treat that as unbounded.
 */
export function retentionMinDate(
  retention: AnalyticsRetention | undefined,
  now: Date
): Date | undefined {
  if (!retention) return undefined;
  return startOfDay(sub(now, { days: retention.queryable_days }));
}

/**
 * The boundary before which data is "cold". Heavy query shapes are restricted
 * past this point unless the plan can query cold.
 */
export function retentionColdBefore(
  retention: AnalyticsRetention | undefined,
  now: Date
): Date | undefined {
  if (!retention) return undefined;
  return startOfDay(sub(now, { days: retention.cold_after_days }));
}

/**
 * Clamp a range start to the volume/aggregate 90-day cap. Returns the later of
 * the requested start and (now - 90d).
 */
export function clampVolumeStart(from: Date, now: Date): Date {
  const floor = startOfDay(sub(now, { days: VOLUME_MAX_DAYS }));
  return from < floor ? floor : from;
}

// ─── Heavy query-shape detection ──────────────────────────────────────────

/** Filter operators the backend treats as "heavy" (restricted in cold data). */
const HEAVY_OPERATORS = new Set(["contains", "not_contains", "is_not"]);

/**
 * A query is "heavy" when it free-text searches or uses a
 * contains/is_not/not_contains filter — these are blocked in the cold window.
 */
export function isHeavyQueryShape(
  searchTerm: string | undefined,
  filters: ReadonlyArray<{ operator: string }>
): boolean {
  if (searchTerm && searchTerm.trim().length > 0) return true;
  return filters.some((f) => HEAVY_OPERATORS.has(f.operator));
}

/**
 * True when a heavy query reaches into the cold window on a plan that can't
 * query cold — the backend will reject this with query_too_heavy, so the UI
 * warns proactively.
 */
export function heavyShapeHitsCold(
  retention: AnalyticsRetention | undefined,
  rangeFrom: Date | undefined,
  isHeavy: boolean,
  now: Date
): boolean {
  if (!retention || !rangeFrom || !isHeavy || retention.can_query_cold) {
    return false;
  }
  const coldBefore = retentionColdBefore(retention, now);
  return !!coldBefore && rangeFrom < coldBefore;
}

// ─── Error mapping (#9 error_code) ────────────────────────────────────────

export interface AnalyticsErrorInfo {
  code?: string;
  title: string;
  description: string;
  /** retention_window_exceeded — the fix is to upgrade the plan. */
  isRetention: boolean;
  /** query_too_heavy — the fix is to narrow the range / drop heavy filters. */
  isHeavy: boolean;
}

/**
 * Map an analytics query error to user-facing copy, branching on the backend
 * `error_code`. Always returns a usable message, even for unknown errors.
 */
export function getAnalyticsErrorInfo(err: unknown): AnalyticsErrorInfo {
  const code = getApiErrorCode(err);

  if (code === ANALYTICS_ERROR_CODES.retentionWindowExceeded) {
    return {
      code,
      title: "Beyond your plan's history",
      description: getApiErrorMessage(
        err,
        "This date range reaches further back than your plan can query. Upgrade to access older analytics."
      ),
      isRetention: true,
      isHeavy: false,
    };
  }

  if (code === ANALYTICS_ERROR_CODES.queryTooHeavy) {
    return {
      code,
      title: "This query is too heavy",
      description: getApiErrorMessage(
        err,
        "Narrow the date range, or remove free-text search and “contains” / “is not” filters, then try again."
      ),
      isRetention: false,
      isHeavy: true,
    };
  }

  return {
    code,
    title: "Couldn't load analytics",
    description: getApiErrorMessage(
      err,
      "Something went wrong loading this data. Please try again."
    ),
    isRetention: false,
    isHeavy: false,
  };
}
