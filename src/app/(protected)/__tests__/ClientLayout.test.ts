import { describe, expect, it } from "vitest";
import { updatedSearchParams } from "@/lib/projectSearchParams";

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
