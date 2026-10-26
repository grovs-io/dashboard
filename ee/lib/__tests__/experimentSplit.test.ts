import { describe, expect, it } from "vitest";
import { sharePercent, splitLegend, splitShares } from "../experimentSplit";

describe("splitShares", () => {
  it("splits the rest evenly between the variants after the control group", () => {
    expect(splitShares({ controlGroup: null, variants: 1 })).toEqual([
      { id: "a", label: "A", share: 50 },
      { id: "b", label: "B", share: 50 },
    ]);
    expect(splitShares({ controlGroup: 10, variants: 1 })).toEqual([
      { id: "control", label: "Control group", share: 10 },
      { id: "a", label: "A", share: 45 },
      { id: "b", label: "B", share: 45 },
    ]);
    expect(splitShares({ controlGroup: null, variants: 0 })).toEqual([
      { id: "a", label: "A", share: 100 },
    ]);
  });

  it("takes the project control group off the top", () => {
    const shares = splitShares({
      controlGroup: 10,
      variants: 1,
      projectControlGroup: 5,
    });
    expect(shares.map((s) => [s.id, s.share])).toEqual([
      ["project_control", 5],
      ["control", 9.5],
      ["a", 42.75],
      ["b", 42.75],
    ]);
    expect(shares.reduce((sum, s) => sum + s.share, 0)).toBe(100);
  });

  it("says it in one line, with counts when the audience is known", () => {
    expect(sharePercent(42.75)).toBe("42.8%");
    expect(sharePercent(45)).toBe("45%");
    const shares = splitShares({ controlGroup: 10, variants: 1 });
    expect(splitLegend(shares)).toBe("Control group 10% · A 45% · B 45%");
    expect(splitLegend(shares, 2000)).toBe(
      "Control group 10% (200) · A 45% (900) · B 45% (900)"
    );
    expect(
      splitLegend(splitShares({ controlGroup: null, variants: 1 }), 0)
    ).toBe("A 50% · B 50%");
  });
});
