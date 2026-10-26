import { describe, expect, it } from "vitest";
import { chooseInstance, updatedSearchParams } from "@/lib/projectSearchParams";

describe("updatedSearchParams", () => {
  it("does not navigate when the project parameters already match", () => {
    expect(
      updatedSearchParams("?env_type=Production&instance_id=1", {
        env_type: "Production",
        instance_id: 1,
      })
    ).toBeNull();
  });

  it("returns the updated query string when a project parameter changes", () => {
    expect(
      updatedSearchParams("?env_type=Production&instance_id=1", {
        env_type: "Test",
        instance_id: 1,
      })
    ).toBe("?env_type=Test&instance_id=1");
  });
});

describe("chooseInstance", () => {
  const sorted = [{ id: 3 }, { id: 2 }, { id: 1 }];

  it("takes the URL first, then what was last chosen on this browser, then the newest", () => {
    expect(chooseInstance(sorted, "1", "2")).toEqual({
      instance: { id: 1 },
      denied: false,
    });
    expect(chooseInstance(sorted, null, "2")).toEqual({
      instance: { id: 2 },
      denied: false,
    });
    expect(chooseInstance(sorted, null, null)).toEqual({
      instance: { id: 3 },
      denied: false,
    });
    expect(chooseInstance(sorted, null, "9")).toEqual({
      instance: { id: 3 },
      denied: false,
    });
  });

  it("falls back to the newest and says so when the URL names one the person cannot open", () => {
    expect(chooseInstance(sorted, "9", "2")).toEqual({
      instance: { id: 3 },
      denied: true,
    });
  });
});
