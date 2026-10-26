import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Plain stub: a vi.fn returning a rejected promise is reported as an error by vitest.
const stub = vi.hoisted(() => ({
  calls: [] as string[],
  result: (): Promise<unknown> => Promise.resolve({}),
}));
vi.mock("@stripe/stripe-js/pure", () => ({
  loadStripe: (key: string) => {
    stub.calls.push(key);
    return stub.result();
  },
}));

const importStripe = async (key: string) => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", key);
  return import("@/lib/stripe");
};

beforeEach(() => {
  stub.calls = [];
  stub.result = () => Promise.resolve({});
});
afterEach(() => vi.unstubAllEnvs());

describe("stripe", () => {
  it("does not load Stripe.js on import", async () => {
    const { hasStripeKey } = await importStripe("pk_test_1");
    expect(hasStripeKey).toBe(true);
    expect(stub.calls).toEqual([]);
  });

  it("loads once and reuses the promise", async () => {
    const stripe = {};
    stub.result = () => Promise.resolve(stripe);
    const { getStripe } = await importStripe("pk_test_1");
    const first = getStripe();
    expect(getStripe()).toBe(first);
    expect(stub.calls).toEqual(["pk_test_1"]);
    await expect(first).resolves.toBe(stripe);
  });

  it("resolves to null when Stripe.js fails to load", async () => {
    stub.result = () => Promise.reject(new Error("blocked"));
    const { getStripe } = await importStripe("pk_test_1");
    await expect(getStripe()).resolves.toBeNull();
  });

  it("returns null without a key", async () => {
    const { getStripe, hasStripeKey } = await importStripe("");
    expect(hasStripeKey).toBe(false);
    expect(getStripe()).toBeNull();
    expect(stub.calls).toEqual([]);
  });
});
