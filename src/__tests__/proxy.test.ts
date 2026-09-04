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
