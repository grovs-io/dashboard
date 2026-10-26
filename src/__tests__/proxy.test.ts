import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

describe("self-hosted registration proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["/register", "/register/with_email"])(
    "redirects %s to login",
    async (pathname) => {
      vi.resetModules();
      vi.doMock("@/lib/edition", () => ({ IS_SELF_HOSTED: true }));
      const { proxy } = await import("../proxy");

      const response = proxy(
        new NextRequest(`https://dashboard.example.com${pathname}`)
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "https://dashboard.example.com/login"
      );
    }
  );

  it("does not block registration in SaaS mode", async () => {
    vi.resetModules();
    vi.doMock("@/lib/edition", () => ({ IS_SELF_HOSTED: false }));
    const { proxy } = await import("../proxy");

    const response = proxy(new NextRequest("https://app.example.com/register"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows browser requests to the API URL supplied at runtime", async () => {
    vi.stubEnv("API_URL", "https://api.customer.example/path");
    vi.resetModules();
    vi.doMock("@/lib/edition", () => ({ IS_SELF_HOSTED: true }));
    const { proxy } = await import("../proxy");

    const response = proxy(new NextRequest("https://dashboard.example.com/"));

    expect(response.headers.get("content-security-policy")).toContain(
      "connect-src 'self' https://api.customer.example"
    );
  });
});

describe("Links Behaviour aliases", () => {
  it.each([
    ["/link_behaviour", "/dynamic_links/settings"],
    ["/link_behaviour/domain", "/dynamic_links/settings/domain"],
    ["/link_behaviour/smart_banners", "/smart_banners"],
    ["/link_behaviour/smart_banners/new", "/smart_banners/new"],
    ["/link_behaviour/smart_banners/7", "/smart_banners/7"],
  ])("redirects %s to %s keeping the query", async (from, to) => {
    vi.resetModules();
    vi.doMock("@/lib/edition", () => ({ IS_SELF_HOSTED: false }));
    const { proxy } = await import("../proxy");

    const response = proxy(
      new NextRequest(
        `https://app.example.com${from}?instance_id=9&env_type=test`
      )
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      `https://app.example.com${to}?instance_id=9&env_type=test`
    );
  });
});

describe("legacy messaging alias", () => {
  it("redirects /messaging to the in-app messages page keeping the query", async () => {
    vi.resetModules();
    vi.doMock("@/lib/edition", () => ({ IS_SELF_HOSTED: false }));
    const { proxy } = await import("../proxy");

    const response = proxy(
      new NextRequest("https://app.example.com/messaging?instance_id=9")
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://app.example.com/in_app?instance_id=9"
    );
  });
});
