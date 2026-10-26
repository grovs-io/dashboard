import { describe, expect, it } from "vitest";
import {
  goalInput,
  goalKind,
  goalReady,
  purchaseGoal,
} from "@ee/types/experiment";
import { goalLabel, goalSubject } from "@ee/lib/inAppComposer";

describe("purchase goals", () => {
  it("are ready without a name and leave an empty product list out", () => {
    const any = purchaseGoal([], 720);
    expect(any).toEqual({ purchase: true, window_hours: 720 });
    expect(goalKind(any)).toBe("purchase");
    expect(goalReady(any)).toBe(true);
    expect(goalReady({ purchase: true, products: [], window_hours: 72 })).toBe(
      false
    );
    expect(
      goalInput({ purchase: true, products: [], window_hours: 72 })
    ).toEqual({
      purchase: true,
      window_hours: 72,
    });
    expect(goalInput(purchaseGoal(["premium"], 72))).toEqual({
      purchase: true,
      products: ["premium"],
      window_hours: 72,
    });
  });

  it("read as a purchase", () => {
    expect(goalSubject(purchaseGoal([], 72))).toBe("a purchase");
    expect(goalLabel(purchaseGoal(["premium", "coins"], 720))).toBe(
      "a purchase of premium, coins within 30 days"
    );
  });

  it("leave named goals as they were", () => {
    expect(goalReady({ event: " ", window_hours: 72 })).toBe(false);
    expect(goalInput({ event: " checkout ", window_hours: 24 })).toEqual({
      event: "checkout",
      window_hours: 24,
    });
    expect(goalInput({ system: "reactivation", window_hours: 168 })).toEqual({
      system: "reactivation",
      window_hours: 168,
    });
  });
});
