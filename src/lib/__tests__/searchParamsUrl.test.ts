import { describe, it, expect, beforeEach } from "vitest";
import { writeSearchParams } from "../searchParamsUrl";

const url = () => window.location.pathname + window.location.search;

describe("writeSearchParams", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/audience/visitors");
  });

  it("adds params to a bare path", () => {
    writeSearchParams({ page: "2" });
    expect(url()).toBe("/audience/visitors?page=2");
  });

  it("merges onto params already in the URL", () => {
    window.history.replaceState(
      null,
      "",
      "/audience/visitors?env_type=Production&instance_id=1288"
    );

    writeSearchParams({ from: "2026-07-01", to: "2026-07-03" });

    expect(url()).toContain("env_type=Production");
    expect(url()).toContain("instance_id=1288");
    expect(url()).toContain("from=2026-07-01");
    expect(url()).toContain("to=2026-07-03");
  });

  it("deletes params for null, undefined and empty string", () => {
    window.history.replaceState(null, "", "/audience/visitors?a=1&b=2&c=3&d=4");

    writeSearchParams({ a: null, b: undefined, c: "" });

    expect(url()).toBe("/audience/visitors?d=4");
  });

  it("drops the question mark when no params remain", () => {
    window.history.replaceState(null, "", "/audience/visitors?page=2");
    writeSearchParams({ page: null });
    expect(url()).toBe("/audience/visitors");
  });

  // Regression: the second of two consecutive picks used to be silently dropped.
  it("lands consecutive writes without losing the earlier one", () => {
    window.history.replaceState(
      null,
      "",
      "/audience/visitors?env_type=Production&instance_id=1247"
    );

    writeSearchParams({ from: "2026-07-08", to: "2026-07-09", page: null });
    expect(url()).toContain("from=2026-07-08");

    writeSearchParams({ from: "2026-07-01", to: "2026-07-03", page: null });

    expect(url()).toContain("from=2026-07-01");
    expect(url()).toContain("to=2026-07-03");
    expect(url()).not.toContain("2026-07-08");
    expect(url()).toContain("instance_id=1247");
  });

  // Regression: a stale snapshot used to be able to write back an old instance_id.
  it("does not resurrect a value that another writer just changed", () => {
    window.history.replaceState(
      null,
      "",
      "/audience/visitors?instance_id=1288"
    );

    writeSearchParams({ instance_id: 1247 });
    writeSearchParams({ platform: "ios" });

    expect(url()).toContain("instance_id=1247");
    expect(url()).not.toContain("1288");
    expect(url()).toContain("platform=ios");
  });

  it("coerces numeric values", () => {
    writeSearchParams({ instance_id: 1288 });
    expect(url()).toBe("/audience/visitors?instance_id=1288");
  });
});
