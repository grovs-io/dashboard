import { describe, it, expect } from "vitest";
import { deriveStep } from "@/components/migration/deriveStep";
import type { CustomDomain, MigrationSource } from "@/types";

const baseDomain = (overrides: Partial<CustomDomain>): CustomDomain => ({
  hostname: "old.acme.com",
  purpose: "migration",
  status: "pending",
  ssl_status: null,
  verification_errors: null,
  source: "saas",
  cname_target: "proxy-fallback.sqd.link",
  ...overrides,
});

const baseSource: MigrationSource = {
  id: 1,
  provider: "branch",
  old_host: "old.acme.com",
  provider_hosted: false,
  extra_hosts: [],
  enabled: true,
  health: "healthy",
  consecutive_failures: 0,
  first_failure_at: null,
  last_error_status: null,
  created_at: "",
  updated_at: "",
};

describe("deriveStep", () => {
  it("loading when queries pending", () => {
    expect(
      deriveStep({
        domainsLoading: true,
        sourceLoading: false,
        domains: undefined,
        source: undefined,
        sourceErrorStatus: undefined,
        attestations: {},
      })
    ).toBe("loading");
  });

  it("feature_off on source 503", () => {
    expect(
      deriveStep({
        domainsLoading: false,
        sourceLoading: false,
        domains: [],
        source: null,
        sourceErrorStatus: 503,
        attestations: {},
      })
    ).toBe("feature_off");
  });

  it("not_admin on source 403", () => {
    expect(
      deriveStep({
        domainsLoading: false,
        sourceLoading: false,
        domains: [],
        source: null,
        sourceErrorStatus: 403,
        attestations: {},
      })
    ).toBe("not_admin");
  });

  it("start when no migration row exists", () => {
    expect(
      deriveStep({
        domainsLoading: false,
        sourceLoading: false,
        domains: [],
        source: null,
        sourceErrorStatus: undefined,
        attestations: {},
      })
    ).toBe("start");
  });

  it("dns_verify while the migration row is pending", () => {
    expect(
      deriveStep({
        domainsLoading: false,
        sourceLoading: false,
        domains: [baseDomain({ status: "pending" })],
        source: baseSource,
        sourceErrorStatus: undefined,
        attestations: {},
      })
    ).toBe("dns_verify");
  });

  it("dns_verify while SSL is still pending even with a source", () => {
    expect(
      deriveStep({
        domainsLoading: false,
        sourceLoading: false,
        domains: [
          baseDomain({
            status: "pending",
            ssl_status: "pending_validation",
          }),
        ],
        source: baseSource,
        sourceErrorStatus: undefined,
        attestations: { cutoverDone: true },
      })
    ).toBe("dns_verify");
  });

  it("dns_failed when migration row failed", () => {
    expect(
      deriveStep({
        domainsLoading: false,
        sourceLoading: false,
        domains: [baseDomain({ status: "failed" })],
        source: baseSource,
        sourceErrorStatus: undefined,
        attestations: {},
      })
    ).toBe("dns_failed");
  });

  it("start when the domain is active but the source is missing", () => {
    expect(
      deriveStep({
        domainsLoading: false,
        sourceLoading: false,
        domains: [baseDomain({ status: "active" })],
        source: null,
        sourceErrorStatus: undefined,
        attestations: { preflightDone: true, cutoverDone: true },
      })
    ).toBe("start");
  });

  it("managed only when the migration row is active and source exists", () => {
    expect(
      deriveStep({
        domainsLoading: false,
        sourceLoading: false,
        domains: [baseDomain({ status: "active" })],
        source: baseSource,
        sourceErrorStatus: undefined,
        attestations: { cutoverDone: false },
      })
    ).toBe("managed");
  });

  it("ignores cutover attestation when the migration row is not active", () => {
    expect(
      deriveStep({
        domainsLoading: false,
        sourceLoading: false,
        domains: [baseDomain({ status: "pending" })],
        source: baseSource,
        sourceErrorStatus: undefined,
        attestations: { cutoverDone: true },
      })
    ).toBe("dns_verify");
  });

  it("managed for a provider-hosted source with no domain row", () => {
    expect(
      deriveStep({
        domainsLoading: false,
        sourceLoading: false,
        domains: [],
        source: { ...baseSource, provider_hosted: true },
        sourceErrorStatus: undefined,
        attestations: {},
      })
    ).toBe("managed");
  });

  it("provider-hosted ignores unrelated domain rows in any state", () => {
    expect(
      deriveStep({
        domainsLoading: false,
        sourceLoading: false,
        domains: [baseDomain({ purpose: "primary", status: "failed" })],
        source: { ...baseSource, provider_hosted: true },
        sourceErrorStatus: undefined,
        attestations: {},
      })
    ).toBe("managed");
  });

  it("still loading while queries pend even for provider-hosted", () => {
    expect(
      deriveStep({
        domainsLoading: true,
        sourceLoading: false,
        domains: undefined,
        source: { ...baseSource, provider_hosted: true },
        sourceErrorStatus: undefined,
        attestations: {},
      })
    ).toBe("loading");
  });

  it("only considers the migration-purpose row", () => {
    expect(
      deriveStep({
        domainsLoading: false,
        sourceLoading: false,
        domains: [baseDomain({ purpose: "primary", status: "active" })],
        source: null,
        sourceErrorStatus: undefined,
        attestations: {},
      })
    ).toBe("start");
  });
});
