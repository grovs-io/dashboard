import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  localDay,
  markDone,
  readStarState,
  recordVisit,
  shouldAsk,
  snooze,
  writeStarState,
  type StarState,
} from "../githubStar";

const NOW = new Date(2026, 9, 21, 12).getTime();
const DAY = 24 * 60 * 60 * 1000;
const base: StarState = { days: [], asks: 0, snoozed_until: 0, done: false };
const visited = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    localDay(new Date(NOW - (n - 1 - i) * DAY))
  ).reduce(recordVisit, base);

describe("recordVisit", () => {
  it("keeps distinct days and only the last three", () => {
    let s = recordVisit(base, "2026-10-18");
    s = recordVisit(s, "2026-10-18");
    expect(s.days).toEqual(["2026-10-18"]);
    s = ["2026-10-19", "2026-10-20", "2026-10-21"].reduce(recordVisit, s);
    expect(s.days).toEqual(["2026-10-19", "2026-10-20", "2026-10-21"]);
  });

  it("formats the local date", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("shouldAsk", () => {
  it("is false on day 1 and 2, true on day 3", () => {
    expect(shouldAsk(visited(1), NOW)).toBe(false);
    expect(shouldAsk(visited(2), NOW)).toBe(false);
    expect(shouldAsk(visited(3), NOW)).toBe(true);
  });

  it("is false when done, after three asks, or while snoozed", () => {
    const ready = visited(3);
    expect(shouldAsk(markDone(ready), NOW)).toBe(false);
    expect(shouldAsk({ ...ready, asks: 3 }, NOW)).toBe(false);
    expect(shouldAsk({ ...ready, asks: 2 }, NOW)).toBe(true);
    const snoozed = snooze(ready, NOW);
    expect(shouldAsk(snoozed, NOW + 29 * DAY)).toBe(false);
    expect(shouldAsk(snoozed, NOW + 30 * DAY)).toBe(true);
  });

  it("is false without a state", () => {
    expect(shouldAsk(null, NOW)).toBe(false);
  });
});

describe("stored state", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("round-trips, and starts empty when nothing is stored", () => {
    expect(readStarState()).toEqual(base);
    const s = { ...visited(3), asks: 1 };
    writeStarState(s);
    expect(readStarState()).toEqual(s);
  });

  it("never asks on corrupt JSON", () => {
    window.localStorage.setItem("grovs:github_star", "{not json");
    expect(readStarState()).toBeNull();
    window.localStorage.setItem("grovs:github_star", "null");
    expect(shouldAsk(readStarState(), NOW)).toBe(false);
  });

  it("never asks when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => writeStarState(visited(3))).not.toThrow();
    expect(shouldAsk(readStarState(), NOW)).toBe(false);
  });
});
