import { describe, it, expect } from "vitest";
import {
  normalizeExtraHosts,
  isValidExtraHost,
  buildCreateMigrationPayload,
} from "@/components/migration/migrationPayload";

describe("normalizeExtraHosts", () => {
  it("trims, lowercases, and drops empties", () => {
    expect(
      normalizeExtraHosts(["  XYZ-Alternate.App.Link ", ""], "xyz.app.link")
    ).toEqual(["xyz-alternate.app.link"]);
  });

  it("dedupes case-insensitively, keeping first-seen order", () => {
    expect(
      normalizeExtraHosts(
        ["b.app.link", "A.app.link", "B.APP.LINK"],
        "xyz.app.link"
      )
    ).toEqual(["b.app.link", "a.app.link"]);
  });

  it("drops the main hostname", () => {
    expect(
      normalizeExtraHosts(["xyz.app.link", "other.app.link"], "XYZ.app.link")
    ).toEqual(["other.app.link"]);
  });
});

describe("isValidExtraHost", () => {
  it("accepts bare hostnames", () => {
    expect(isValidExtraHost("xyz-alternate.app.link")).toBe(true);
  });

  it("rejects schemes, ports, paths, and non-hostnames", () => {
    expect(isValidExtraHost("https://xyz.app.link")).toBe(false);
    expect(isValidExtraHost("xyz.app.link:443")).toBe(false);
    expect(isValidExtraHost("xyz.app.link/path")).toBe(false);
    expect(isValidExtraHost("not a host")).toBe(false);
  });
});

describe("buildCreateMigrationPayload", () => {
  const base = {
    provider: "branch" as const,
    hostname: "xyz.app.link",
    credentials: { branch_key: "key_live_abc" },
  };

  it("classic mode omits the new keys entirely", () => {
    const payload = buildCreateMigrationPayload({
      ...base,
      providerHosted: false,
      extraHosts: ["ignored.app.link"],
    });
    expect(payload).toEqual({
      hostname: "xyz.app.link",
      provider: "branch",
      credentials: { branch_key: "key_live_abc" },
    });
    expect("provider_hosted" in payload).toBe(false);
    expect("extra_hosts" in payload).toBe(false);
  });

  it("provider-hosted sets the flag and normalized extra hosts", () => {
    expect(
      buildCreateMigrationPayload({
        ...base,
        providerHosted: true,
        extraHosts: [" XYZ-Alternate.App.Link ", "xyz.app.link"],
      })
    ).toEqual({
      hostname: "xyz.app.link",
      provider: "branch",
      credentials: { branch_key: "key_live_abc" },
      provider_hosted: true,
      extra_hosts: ["xyz-alternate.app.link"],
    });
  });

  it("provider-hosted omits extra_hosts when the list is empty", () => {
    const payload = buildCreateMigrationPayload({
      ...base,
      providerHosted: true,
      extraHosts: [],
    });
    expect(payload).toEqual({
      hostname: "xyz.app.link",
      provider: "branch",
      credentials: { branch_key: "key_live_abc" },
      provider_hosted: true,
    });
    expect("extra_hosts" in payload).toBe(false);
  });
});
