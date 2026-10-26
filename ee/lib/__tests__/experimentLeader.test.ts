import { describe, expect, it } from "vitest";
import { inAppExperiment } from "./inAppFixtures";
import {
  leaderOf,
  leaderSentence,
  underMinPeople,
  variantRates,
} from "../experimentLeader";
import { inAppVerdict } from "@ee/components/in_app/InAppExperimentBanner";

const live = {
  launched_at: "2026-09-20T10:00:00.000Z",
  status: "live" as const,
};

describe("the leader", () => {
  it("reads the metric's rate per variant, A first", () => {
    const rates = variantRates(inAppExperiment(), "opens");
    expect(rates.map((r) => [r.id, r.rate])).toEqual([
      ["a", 0.148],
      ["b", 0.1713],
    ]);
    expect(variantRates(inAppExperiment(), "conversions")[1]!.rate).toBe(
      0.0654
    );
    expect(leaderOf(rates).leader?.id).toBe("b");
    expect(leaderSentence(rates)).toBe("B leads: 17.1% vs 14.8%");
  });

  it("says a tie, three variants, and nothing without data", () => {
    const three = inAppExperiment({
      groups: [
        ...inAppExperiment().groups,
        { ...inAppExperiment().groups[1]!, id: "c", click_rate: 0.09 },
      ],
    });
    expect(leaderSentence(variantRates(three, "opens"))).toBe(
      "B leads: A 14.8%, B 17.1%, C 9.0%"
    );
    const tied = inAppExperiment({
      groups: inAppExperiment().groups.map((g) =>
        g.id === "b" ? { ...g, click_rate: 0.148 } : g
      ),
    });
    expect(leaderSentence(variantRates(tied, "opens"))).toBe(
      "A and B are tied; a tie goes to A"
    );
    // The backend's max_by keeps the earliest of the best, so a B/C tie goes to B.
    const bc = inAppExperiment({
      groups: [
        ...inAppExperiment().groups,
        { ...inAppExperiment().groups[1]!, id: "c" },
      ],
    });
    expect(leaderOf(variantRates(bc, "opens")).leader?.id).toBe("b");
    expect(leaderSentence(variantRates(bc, "opens"))).toBe(
      "B and C are tied; a tie goes to B"
    );
    const empty = inAppExperiment({
      groups: inAppExperiment().groups.map((g) => ({ ...g, click_rate: null })),
    });
    expect(leaderOf(variantRates(empty, "opens")).leader).toBeNull();
    expect(leaderSentence(variantRates(empty, "opens"))).toBeNull();
  });
});

describe("underMinPeople", () => {
  it("is true while any variant has fewer than 100 exposed people", () => {
    expect(underMinPeople(variantRates(inAppExperiment(), "opens"))).toBe(
      false
    );
    const small = inAppExperiment({
      groups: inAppExperiment().groups.map((g) =>
        g.id === "b" ? { ...g, exposed: 99 } : g
      ),
    });
    expect(underMinPeople(variantRates(small, "opens"))).toBe(true);
    const enough = inAppExperiment({
      groups: inAppExperiment().groups.map((g) =>
        g.id === "b" ? { ...g, exposed: 100 } : g
      ),
    });
    expect(underMinPeople(variantRates(enough, "opens"))).toBe(false);
  });
});

describe("inAppVerdict", () => {
  it("names the better variant once it is sure, with the control's lift", () => {
    expect(inAppVerdict(inAppExperiment(), live)).toEqual({
      text: "B does better than A: 6.5% vs 5.7% conversion rate (96% confidence) · variants beat the control by 83%.",
      winner: "b",
    });
    const clicks = inAppExperiment({
      goal: null,
      control_group: null,
      lift: null,
    });
    expect(inAppVerdict(clicks, live).text).toBe(
      "B does better than A: 17.1% vs 14.8% click rate (96% confidence)."
    );
  });

  it("quotes the control only when the variants beat it for sure", () => {
    const base = inAppExperiment();
    expect(inAppVerdict({ ...base, confidence: 0.6 }, live).text).toBe(
      "B does better than A: 6.5% vs 5.7% conversion rate (96% confidence)."
    );
    expect(inAppVerdict({ ...base, lift: -0.1 }, live).text).toBe(
      "B does better than A: 6.5% vs 5.7% conversion rate (96% confidence)."
    );
    const nobody = {
      ...base,
      lift: null,
      groups: base.groups.map((g) =>
        g.id === "control" ? { ...g, converted: 0, conversion_rate: 0 } : g
      ),
    };
    expect(inAppVerdict(nobody, live).text).toBe(
      "B does better than A: 6.5% vs 5.7% conversion rate (96% confidence) · the control converted nobody."
    );
  });

  it("says the experiment is still running otherwise", () => {
    const unsure = inAppExperiment({
      more_people_needed: 1900,
      groups: inAppExperiment().groups.map((g) =>
        g.id === "b" ? { ...g, confidence: 0.7 } : g
      ),
    });
    expect(inAppVerdict(unsure, live)).toEqual({
      text: "Experiment running since 20 Sep 2026 · 4,120 saw A, 4,098 saw B · not enough people yet for a clear answer.",
      winner: null,
    });
  });

  it("A wins when every variant is worse, judged by the complement of its confidence", () => {
    const aBest = inAppExperiment({
      groups: inAppExperiment().groups.map((g) =>
        g.id === "b" ? { ...g, conversion_rate: 0.041, confidence: 0.03 } : g
      ),
    });
    expect(inAppVerdict(aBest, live)).toMatchObject({
      text: expect.stringMatching(
        /^A does better than B: 5.7% vs 4.1% conversion rate \(97% confidence\)/
      ),
      winner: "a",
    });
    // A worse variant with a high P(beats A) is not a verdict for A.
    const unsure = inAppExperiment({
      groups: inAppExperiment().groups.map((g) =>
        g.id === "b" ? { ...g, conversion_rate: 0.041, confidence: 0.97 } : g
      ),
    });
    expect(inAppVerdict(unsure, live).winner).toBeNull();
  });

  it("a goal alone says what the message led to", () => {
    const goalOnly = inAppExperiment({
      control_group: null,
      lift: null,
      added_conversions: null,
      confidence: null,
      groups: inAppExperiment().groups.filter((g) => g.id === "a"),
    });
    expect(inAppVerdict(goalOnly, live)).toEqual({
      text: "233 of 4,120 people converted (5.7%) within 3 days of seeing the message.",
      winner: null,
    });
  });

  it("with a control group only, it is the card's sentence", () => {
    const control = inAppExperiment({
      groups: inAppExperiment().groups.filter((g) => g.id !== "b"),
    });
    expect(inAppVerdict(control, live)).toEqual({
      text: "Variants convert 83% better than the control: about +47 conversions (99% confidence).",
      winner: null,
    });
  });
});
