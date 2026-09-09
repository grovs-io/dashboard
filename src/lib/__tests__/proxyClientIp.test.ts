import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/serverConfig", () => ({
  serverConfig: {
    get trustedProxySecret() {
      return mockSecret;
    },
  },
}));

let mockSecret: string | undefined = "s3cret";

import { proxyClientIpHeaders } from "../proxyClientIp";

const req = (xff?: string) =>
  new Request("https://dashboard.example/api/auth/token", {
    headers: xff ? { "x-forwarded-for": xff } : {},
  });

describe("proxyClientIpHeaders", () => {
  it("forwards the last x-forwarded-for entry, the one the load balancer appends", () => {
    expect(proxyClientIpHeaders(req("1.2.3.4, 203.0.113.9"))).toEqual({
      "X-Grovs-Client-IP": "203.0.113.9",
      "X-Grovs-Proxy-Auth": "s3cret",
    });
  });

  it("handles a single entry", () => {
    expect(proxyClientIpHeaders(req("203.0.113.9"))["X-Grovs-Client-IP"]).toBe(
      "203.0.113.9"
    );
  });

  it("sends nothing without x-forwarded-for", () => {
    expect(proxyClientIpHeaders(req())).toEqual({});
  });

  it("sends nothing when the client secret is unset", () => {
    mockSecret = undefined;
    expect(proxyClientIpHeaders(req("203.0.113.9"))).toEqual({});
    mockSecret = "s3cret";
  });
});
