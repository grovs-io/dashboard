import { describe, it, expect, vi } from "vitest";

// SaaS build must never render manual mode, whatever the backend claims.
vi.mock("@/lib/edition", () => ({
  IS_ENTERPRISE: false,
  IS_SELF_HOSTED: false,
}));

const { isManualCustomDomainMode } = await import("@/lib/customDomainStatus");

describe("isManualCustomDomainMode (SaaS build)", () => {
  it("is false regardless of tls_mode", () => {
    expect(isManualCustomDomainMode("manual")).toBe(false);
    expect(isManualCustomDomainMode("cloudflare")).toBe(false);
    expect(isManualCustomDomainMode(undefined)).toBe(false);
  });
});
