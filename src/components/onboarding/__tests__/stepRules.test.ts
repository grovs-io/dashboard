import { describe, expect, it } from "vitest";
import type { CustomDomain, RedirectConfig } from "@/types";
import { initialLinkValues, linkValuesValid } from "../steps/links/LinksStep";
import { dnsRecordsFor, recordsMailto } from "../steps/domain/DnsView";
import {
  EMPTY_MIGRATION,
  migrationDraftValid,
  migrationPayload,
} from "../steps/domain/MigrationAddon";
import { planLabel } from "../steps/domain/PlanList";

const config = (over: Partial<RedirectConfig> = {}): RedirectConfig => ({
  default_fallback: "",
  show_preview_android: false,
  show_preview_ios: false,
  ...over,
});

describe("Links defaults", () => {
  it("opens the app and falls back to the store on connected platforms", () => {
    const v = initialLinkValues(config(), { ios: true, android: true });
    expect(v.ios).toMatchObject({ enabled: true, appStore: true });
    expect(v.android).toMatchObject({ enabled: true, appStore: true });
    expect(v.desktop.generatedPage).toBe(true);
  });

  it("preselects a custom page on a platform that isn't connected", () => {
    const v = initialLinkValues(
      config({ android: { phone: { enabled: true, appstore: true } } }),
      { ios: true, android: false }
    );
    expect(v.android.enabled).toBe(false);
  });

  it("keeps rules that were already saved", () => {
    const v = initialLinkValues(
      config({
        default_fallback: "https://a.io",
        ios: {
          phone: {
            enabled: true,
            appstore: false,
            fallback_url: "https://a.io/x",
          },
        },
      }),
      { ios: true, android: true }
    );
    expect(v.defaultUrl).toBe("https://a.io");
    expect(v.ios).toMatchObject({
      enabled: true,
      appStore: false,
      customUrl: "https://a.io/x",
    });
  });
});

describe("Links validation", () => {
  const connected = { ios: true, android: false };
  const valid = () =>
    initialLinkValues(config({ default_fallback: "https://a.io" }), connected);

  it("needs an https fallback", () => {
    const v = initialLinkValues(config(), connected);
    expect(linkValuesValid(v, connected)).toBe(false);
    expect(
      linkValuesValid({ ...v, defaultUrl: "http://a.io" }, connected)
    ).toBe(false);
    expect(linkValuesValid(valid(), connected)).toBe(true);
  });

  it("needs a valid URL for any custom page that was chosen", () => {
    const v = valid();
    expect(
      linkValuesValid({ ...v, ios: { ...v.ios, appStore: false } }, connected)
    ).toBe(false);
    expect(
      linkValuesValid(
        {
          ...v,
          ios: { ...v.ios, appStore: false, customUrl: "https://a.io/d" },
        },
        connected
      )
    ).toBe(true);
    expect(
      linkValuesValid(
        { ...v, desktop: { generatedPage: false, customUrl: "" } },
        connected
      )
    ).toBe(false);
  });

  it("lets an unconnected platform's empty page use the fallback", () => {
    const v = valid();
    expect(linkValuesValid(v, connected)).toBe(true);
    expect(
      linkValuesValid(
        { ...v, android: { ...v.android, customUrl: "https://" } },
        connected
      )
    ).toBe(false);
  });
});

const domain = (over: Partial<CustomDomain> = {}): CustomDomain => ({
  hostname: "links.segments.io",
  purpose: "primary",
  status: "pending",
  ssl_status: "pending_validation",
  verification_errors: null,
  source: "saas",
  cname_target: "proxy.sqd.link",
  ssl_validation_txt_records: [
    { name: "_acme-challenge.links.segments.io", value: "k3Jx9QwP2" },
  ],
  ...over,
});

describe("DNS records", () => {
  it("shows fully-qualified record names", () => {
    expect(dnsRecordsFor(domain(), false)).toEqual([
      { type: "CNAME", name: "links.segments.io", value: "proxy.sqd.link" },
      {
        type: "TXT",
        name: "_acme-challenge.links.segments.io",
        value: "k3Jx9QwP2",
      },
    ]);
  });

  it("keeps multi-label suffixes like co.uk intact", () => {
    const rows = dnsRecordsFor(
      domain({
        hostname: "links.company.co.uk",
        ssl_validation_txt_records: [
          { name: "_acme-challenge.links.company.co.uk", value: "tok" },
        ],
      }),
      false
    );
    expect(rows.map((r) => r.name)).toEqual([
      "links.company.co.uk",
      "_acme-challenge.links.company.co.uk",
    ]);
  });

  it("adds the ownership TXT while it's pending", () => {
    const rows = dnsRecordsFor(
      domain({
        ownership_verification_txt_name:
          "_cf-custom-hostname.links.segments.io",
        ownership_verification_txt_value: "uuid-1",
      }),
      false
    );
    expect(rows[1]).toEqual({
      type: "TXT",
      name: "_cf-custom-hostname.links.segments.io",
      value: "uuid-1",
    });
  });

  it("uses the deployment's own records in manual mode", () => {
    const rows = dnsRecordsFor(
      domain({
        setup_records: [
          {
            kind: "certificate",
            type: null,
            name: null,
            value: null,
            note: "x",
          },
          {
            kind: "dns",
            type: "A",
            name: "links.segments.io",
            value: "1.2.3.4",
            note: "",
          },
        ],
      }),
      true
    );
    expect(rows).toEqual([
      { type: "A", name: "links.segments.io", value: "1.2.3.4" },
    ]);
  });

  it("writes the records into a teammate email", () => {
    const href = decodeURIComponent(
      recordsMailto("links.segments.io", dnsRecordsFor(domain(), false))
    );
    expect(href).toContain("DNS records for links.segments.io");
    expect(href).toContain("CNAME  links.segments.io  proxy.sqd.link");
  });
});

describe("Migration add-on", () => {
  it("needs the old domain and the provider's credentials", () => {
    expect(migrationDraftValid(EMPTY_MIGRATION)).toBe(false);
    const branch = {
      ...EMPTY_MIGRATION,
      enabled: true,
      hostname: "links.segments.io",
      branch: { branch_key: "key_live_abc123" },
    };
    expect(migrationDraftValid(branch)).toBe(true);
    expect(migrationDraftValid({ ...branch, hostname: "https://x.io" })).toBe(
      false
    );
    expect(migrationDraftValid({ ...branch, provider: "appsflyer" })).toBe(
      false
    );
  });

  it("builds the existing migration payload", () => {
    expect(
      migrationPayload({
        ...EMPTY_MIGRATION,
        provider: "appsflyer",
        hostname: " old.segments.io ",
        appsflyer: { onelink_id: "abc", api_token: "tok" },
      })
    ).toEqual({
      hostname: "old.segments.io",
      provider: "appsflyer",
      credentials: { onelink_id: "abc", api_token: "tok" },
    });
  });
});

describe("plan label", () => {
  it("reads like the footer of the own-domain choice", () => {
    expect(planLabel({ plan: "growth_250k", interval: "yearly" })).toBe(
      "Growth 250K · $2,500 / year"
    );
    expect(planLabel({ plan: "scale_1m", interval: "monthly" })).toBe(
      "Scale 1M · $1,199 / month"
    );
  });
});
