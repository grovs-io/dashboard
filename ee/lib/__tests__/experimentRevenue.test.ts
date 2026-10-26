import { describe, expect, it } from "vitest";
import { revenueSentence } from "@ee/components/experiments/ExperimentCard";
import { inAppExperiment } from "./inAppFixtures";

describe("revenueSentence", () => {
  it("says how much more, with the share per person", () => {
    expect(revenueSentence(inAppExperiment())).toBe(
      "Variants brought about $1,240 more than the control (+18% per person)."
    );
  });

  it("says less when the variants earned less", () => {
    expect(
      revenueSentence(
        inAppExperiment({ added_revenue_cents: -31000, revenue_lift: -0.06 })
      )
    ).toBe(
      "Variants brought about $310 less than the control (−6% per person)."
    );
  });

  it("drops the share when the control earned nothing, and says nothing without a comparison", () => {
    expect(
      revenueSentence(
        inAppExperiment({ added_revenue_cents: 5000, revenue_lift: null })
      )
    ).toBe("Variants brought about $50 more than the control.");
    expect(
      revenueSentence(inAppExperiment({ added_revenue_cents: null }))
    ).toBeNull();
  });

  it("says nothing when an older backend or cached report omits the fields", () => {
    expect(
      revenueSentence(
        inAppExperiment({
          added_revenue_cents: undefined,
          revenue_lift: undefined,
        })
      )
    ).toBeNull();
  });

  it("says nothing when the difference rounds to no dollars", () => {
    expect(
      revenueSentence(
        inAppExperiment({ added_revenue_cents: 40, revenue_lift: 0.001 })
      )
    ).toBeNull();
  });
});
