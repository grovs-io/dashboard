import { describe, expect, it } from "vitest";
import {
  pathConfidence,
  pathLeader,
  pathLeaderIsClear,
  pathLeaderSentence,
} from "../ExperimentCard";
import type { Experiment, ExperimentGroup } from "@ee/types/experiment";

const LABELS = { a: "Path A", b: "Path B", c: "Path C" };

const group = (over: Partial<ExperimentGroup>): ExperimentGroup => ({
  id: "a",
  exposed: 1000,
  clicked: null,
  click_rate: null,
  converted: null,
  conversion_rate: null,
  confidence: null,
  revenue_cents: 0,
  revenue_per_person_cents: 0,
  ...over,
});

const experiment = (
  groups: ExperimentGroup[],
  goal: unknown = null
): Experiment => ({
  goal: goal as Experiment["goal"],
  control_group: null,
  project_control_group: 0,
  test_share: null,
  groups,
  lift: null,
  added_conversions: null,
  confidence: null,
  more_people_needed: null,
  revenue_lift: null,
  added_revenue_cents: null,
});

describe("pathLeaderSentence", () => {
  it("names the top revenue path against path A, without a conversion confidence", () => {
    const e = experiment([
      group({ id: "a", revenue_cents: 100000, revenue_per_person_cents: 100 }),
      group({
        id: "b",
        revenue_cents: 150000,
        revenue_per_person_cents: 150,
        confidence: 0.93,
      }),
    ]);
    expect(pathLeaderSentence(e, LABELS)).toBe(
      "Path B earned the most: $1.50 per person, +50% vs Path A."
    );
  });

  it("compares against the runner-up, without confidence, when path A itself leads", () => {
    const e = experiment([
      group({ id: "a", revenue_cents: 200000, revenue_per_person_cents: 200 }),
      group({
        id: "b",
        revenue_cents: 120000,
        revenue_per_person_cents: 120,
        confidence: 0.4,
      }),
      group({ id: "c", revenue_cents: 90000, revenue_per_person_cents: 90 }),
    ]);
    expect(pathLeaderSentence(e, LABELS)).toBe(
      "Path A earned the most: $2.00 per person, +67% vs Path B."
    );
  });

  it("says the other path earned nothing instead of a misleading +0%", () => {
    const zero = experiment([
      group({ id: "a", revenue_cents: 0, revenue_per_person_cents: 0 }),
      group({
        id: "b",
        revenue_cents: 142000,
        revenue_per_person_cents: 142,
        confidence: 0.88,
      }),
    ]);
    expect(pathLeaderSentence(zero, LABELS)).toBe(
      "Path B earned the most: $1.42 per person; Path A earned nothing."
    );

    const nullRevenue = experiment([
      group({ id: "a", revenue_cents: 0, revenue_per_person_cents: null }),
      group({ id: "b", revenue_cents: 142000, revenue_per_person_cents: 142 }),
    ]);
    expect(pathLeaderSentence(nullRevenue, LABELS)).toBe(
      "Path B earned the most: $1.42 per person; Path A earned nothing."
    );
  });

  it("falls back to conversion rate when nobody earned any revenue", () => {
    const e = experiment(
      [
        group({ id: "a", converted: 100, conversion_rate: 0.1 }),
        group({
          id: "b",
          converted: 150,
          conversion_rate: 0.15,
          confidence: 0.97,
        }),
      ],
      { event: "checkout", window_hours: 168 }
    );
    expect(pathLeaderSentence(e, LABELS)).toBe(
      "Path B converted best: 15% vs 10% for Path A (97% confidence)."
    );
  });

  it("is null with no goal, no revenue, or fewer than two exposed paths", () => {
    const noGoalNoRevenue = experiment([
      group({ id: "a" }),
      group({ id: "b" }),
    ]);
    expect(pathLeaderSentence(noGoalNoRevenue, LABELS)).toBeNull();

    const oneExposed = experiment(
      [
        group({ id: "a", exposed: 500, converted: 50, conversion_rate: 0.1 }),
        group({ id: "b", exposed: 0 }),
      ],
      { event: "checkout", window_hours: 168 }
    );
    expect(pathLeaderSentence(oneExposed, LABELS)).toBeNull();
  });
});

describe("pathLeader", () => {
  it("picks the top revenue path", () => {
    const e = experiment([
      group({ id: "a", revenue_cents: 100000, revenue_per_person_cents: 100 }),
      group({ id: "b", revenue_cents: 150000, revenue_per_person_cents: 150 }),
    ]);
    expect(pathLeader(e)).toBe("b");
  });

  it("falls back to the top conversion path when nobody earned revenue", () => {
    const e = experiment(
      [
        group({ id: "a", converted: 100, conversion_rate: 0.1 }),
        group({ id: "b", converted: 150, conversion_rate: 0.15 }),
        group({ id: "c", converted: 80, conversion_rate: 0.08 }),
      ],
      { event: "checkout", window_hours: 168 }
    );
    expect(pathLeader(e)).toBe("b");
  });

  it("is null with no goal, no revenue, or fewer than two exposed paths", () => {
    const noGoalNoRevenue = experiment([
      group({ id: "a" }),
      group({ id: "b" }),
    ]);
    expect(pathLeader(noGoalNoRevenue)).toBeNull();

    const oneExposed = experiment(
      [
        group({ id: "a", exposed: 500, converted: 50, conversion_rate: 0.1 }),
        group({ id: "b", exposed: 0 }),
      ],
      { event: "checkout", window_hours: 168 }
    );
    expect(pathLeader(oneExposed)).toBeNull();
  });
});

describe("path leader edge cases", () => {
  const goal = { purchase: true, window_hours: 168 };

  it("ranks by revenue per person before rounding", () => {
    const e = experiment([
      group({
        id: "a",
        exposed: 100,
        revenue_cents: 51,
        revenue_per_person_cents: 1,
      }),
      group({
        id: "b",
        exposed: 100,
        revenue_cents: 149,
        revenue_per_person_cents: 1,
      }),
    ]);
    expect(pathLeader(e)).toBe("b");
  });

  it("gives path A the runner-up's confidence turned around when A leads", () => {
    const e = experiment(
      [
        group({ id: "a", converted: 200, conversion_rate: 0.2 }),
        group({
          id: "b",
          converted: 100,
          conversion_rate: 0.1,
          confidence: 0.01,
        }),
      ],
      goal
    );
    expect(pathLeader(e)).toBe("a");
    expect(pathConfidence(e)).toBeCloseTo(0.99);
    expect(pathLeaderIsClear(e)).toBe(true);
  });

  it("is not clear when revenue and conversions disagree, or conversions are unsure", () => {
    const disagree = experiment(
      [
        group({ id: "a", conversion_rate: 0.2, revenue_cents: 1000 }),
        group({
          id: "b",
          conversion_rate: 0.1,
          confidence: 0.01,
          revenue_cents: 5000,
        }),
      ],
      goal
    );
    expect(pathLeader(disagree)).toBe("b");
    expect(pathLeaderIsClear(disagree)).toBe(false);
    const unsure = experiment(
      [
        group({ id: "a", conversion_rate: 0.1, revenue_cents: 1000 }),
        group({
          id: "b",
          conversion_rate: 0.12,
          confidence: 0.8,
          revenue_cents: 2000,
        }),
      ],
      goal
    );
    expect(pathLeaderIsClear(unsure)).toBe(false);
  });
});

describe("path leader with rounded or three-way numbers", () => {
  const goal = { purchase: true, window_hours: 168 };

  it("quotes the lift from exact revenue, not the rounded cents", () => {
    const e = experiment([
      group({
        id: "a",
        exposed: 100,
        revenue_cents: 51,
        revenue_per_person_cents: 1,
      }),
      group({
        id: "b",
        exposed: 100,
        revenue_cents: 149,
        revenue_per_person_cents: 1,
      }),
    ]);
    expect(pathLeaderSentence(e, LABELS)).toBe(
      "Path B earned the most: $0.01 per person, +192% vs Path A."
    );
  });

  it("is never clear for a third path the confidence can't compare", () => {
    const e = experiment(
      [
        group({ id: "a", conversion_rate: 0.05, revenue_cents: 100 }),
        group({
          id: "b",
          conversion_rate: 0.2,
          confidence: 0.999,
          revenue_cents: 9000,
        }),
        group({
          id: "c",
          conversion_rate: 0.19,
          confidence: 0.999,
          revenue_cents: 8900,
        }),
      ],
      goal
    );
    expect(pathLeader(e)).toBe("b");
    expect(pathLeaderIsClear(e)).toBe(false);
  });

  it("when path A leads, is only as sure as its closest challenger allows", () => {
    const e = experiment(
      [
        group({ id: "a", conversion_rate: 0.3, revenue_cents: 9000 }),
        group({
          id: "b",
          conversion_rate: 0.1,
          confidence: 0.001,
          revenue_cents: 1000,
        }),
        group({
          id: "c",
          conversion_rate: 0.28,
          confidence: 0.3,
          revenue_cents: 2000,
        }),
      ],
      goal
    );
    expect(pathConfidence(e)).toBeCloseTo(0.7);
    expect(pathLeaderIsClear(e)).toBe(false);
  });
});
