import { describe, it, expect, vi } from "vitest";
import type { CustomDomain } from "@/types";

// Self-hosted build side of the manual-mode gate.
vi.mock("@/lib/edition", () => ({
  IS_ENTERPRISE: false,
  IS_SELF_HOSTED: true,
}));

const { isLegacyCustomDomainPayload, isManualCustomDomainMode } =
  await import("@/lib/customDomainStatus");

const manualRow: CustomDomain = {
  hostname: "links.acme.com",
  purpose: "primary",
  status: "pending",
  ssl_status: null,
  verification_errors: null,
  source: "enterprise",
  cname_target: "links.app.com",
  setup_records: [
    {
      kind: "certificate",
      type: null,
      name: null,
      value: null,
      note: "Issue a certificate covering links.acme.com.",
    },
    {
      kind: "dns",
      type: "CNAME",
      name: "links.acme.com",
      value: "links.app.com",
      note: "Add this only after the certificate is attached.",
    },
  ],
};

const legacyRow: CustomDomain = {
  hostname: "links.acme.com",
  purpose: "primary",
  status: "pending",
  ssl_status: null,
  verification_errors: null,
  source: "saas",
  cname_target: "proxy-fallback.grovs.link",
};

describe("isLegacyCustomDomainPayload", () => {
  it("still detects a legacy payload when the envelope has no tls_mode", () => {
    expect(isLegacyCustomDomainPayload(legacyRow)).toBe(true);
    expect(isLegacyCustomDomainPayload(legacyRow, undefined)).toBe(true);
  });

  it("never reads a row as legacy when the envelope carries tls_mode", () => {
    expect(isLegacyCustomDomainPayload(manualRow, "manual")).toBe(false);
    expect(isLegacyCustomDomainPayload(legacyRow, "cloudflare")).toBe(false);
  });
});

describe("isManualCustomDomainMode (self-hosted build)", () => {
  it("is true only for tls_mode manual", () => {
    expect(isManualCustomDomainMode("manual")).toBe(true);
    expect(isManualCustomDomainMode("cloudflare")).toBe(false);
    expect(isManualCustomDomainMode(undefined)).toBe(false);
  });
});
