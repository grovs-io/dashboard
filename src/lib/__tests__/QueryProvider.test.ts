import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/ApiError";
import { shouldRetry } from "@/lib/QueryProvider";

vi.mock("next/dynamic", () => ({ default: () => () => null }));

describe("shouldRetry", () => {
  it("retries a network or 5xx failure once", () => {
    expect(shouldRetry(0, new Error("network"))).toBe(true);
    expect(shouldRetry(0, new ApiError("x", 500))).toBe(true);
    expect(shouldRetry(1, new ApiError("x", 500))).toBe(false);
  });

  it("never retries a 503 or a 4xx client error", () => {
    expect(shouldRetry(0, new ApiError("x", 503))).toBe(false);
    for (const status of [400, 403, 404, 409, 422, 429])
      expect(shouldRetry(0, new ApiError("query_too_heavy", status))).toBe(
        false
      );
  });
});
