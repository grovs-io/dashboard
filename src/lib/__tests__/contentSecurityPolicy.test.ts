import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "@/lib/contentSecurityPolicy";

const directive = (csp: string, name: string) =>
  csp
    .split("; ")
    .find((d) => d.startsWith(`${name} `))
    ?.split(" ")
    .slice(1) ?? [];

const apiUrl = "https://api.customer.example";

describe("buildContentSecurityPolicy Stripe sources", () => {
  it("allows Stripe.js, Checkout Elements and Link when Stripe is enabled", () => {
    const csp = buildContentSecurityPolicy({ apiUrl, stripeEnabled: true });
    expect(directive(csp, "script-src")).toEqual(
      expect.arrayContaining([
        "https://js.stripe.com",
        "https://*.js.stripe.com",
        "https://checkout.stripe.com",
      ])
    );
    expect(directive(csp, "frame-src")).toEqual(
      expect.arrayContaining([
        "'self'",
        apiUrl,
        "https://js.stripe.com",
        "https://*.js.stripe.com",
        "https://hooks.stripe.com",
        "https://checkout.stripe.com",
        "https://link.com",
        "https://*.link.com",
      ])
    );
    expect(directive(csp, "connect-src")).toEqual(
      expect.arrayContaining([
        apiUrl,
        "https://api.stripe.com",
        "https://checkout.stripe.com",
        "https://merchant-ui-api.stripe.com",
        "https://errors.stripe.com",
        "https://link.com",
        "https://*.link.com",
        "https://fonts.googleapis.com",
      ])
    );
  });

  it("adds no Stripe sources when Stripe is disabled", () => {
    const csp = buildContentSecurityPolicy({ apiUrl });
    expect(csp).not.toContain("stripe.com");
    expect(csp).not.toContain("link.com");
    expect(directive(csp, "frame-src")).toEqual(["'self'", apiUrl]);
  });
});
