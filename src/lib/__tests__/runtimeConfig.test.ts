import { afterEach, describe, expect, it, vi } from "vitest";

describe("runtime dashboard configuration", () => {
  afterEach(() => {
    delete window.__GROVS_RUNTIME_CONFIG__;
    vi.resetModules();
  });

  it("uses the API URL injected when the container starts", async () => {
    window.__GROVS_RUNTIME_CONFIG__ = {
      apiUrl: "https://api.customer.example",
    };

    const { config } = await import("@/lib/config");

    expect(config.apiUrl).toBe("https://api.customer.example");
  });

  it("serializes the runtime API URL without allowing script injection", async () => {
    const { serializeRuntimeConfig } =
      await import("@/lib/serverRuntimeConfig");

    expect(serializeRuntimeConfig("https://api.example/<script>")).toBe(
      'window.__GROVS_RUNTIME_CONFIG__={"apiUrl":"https://api.example/\\u003cscript>"};'
    );
  });

  it("allows browser connections to the runtime API origin", async () => {
    const { buildContentSecurityPolicy } =
      await import("@/lib/contentSecurityPolicy");

    expect(
      buildContentSecurityPolicy({
        apiUrl: "https://api.customer.example",
      })
    ).toContain("connect-src 'self' https://api.customer.example");
  });
});
