import { describe, expect, it, vi } from "vitest";
import type { Subscription } from "@/types";

const edition = vi.hoisted(() => ({ IS_SELF_HOSTED: false }));
vi.mock("@/lib/edition", () => ({
  get IS_SELF_HOSTED() {
    return edition.IS_SELF_HOSTED;
  },
}));

import { hasPaidPlan } from "../plan";

const sub = (over: Partial<Subscription> = {}) =>
  ({ payment_issue: false, ...over }) as Subscription;

describe("hasPaidPlan", () => {
  it("needs a subscription without a payment issue on cloud", () => {
    edition.IS_SELF_HOSTED = false;
    expect(hasPaidPlan(undefined)).toBe(false);
    expect(hasPaidPlan(sub({ payment_issue: true }))).toBe(false);
    expect(hasPaidPlan(sub())).toBe(true);
  });

  it("is always paid on self-hosted", () => {
    edition.IS_SELF_HOSTED = true;
    expect(hasPaidPlan(undefined)).toBe(true);
  });
});
