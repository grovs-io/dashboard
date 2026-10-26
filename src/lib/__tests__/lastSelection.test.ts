import { beforeEach, describe, expect, it } from "vitest";
import { readLastSelection, writeLastSelection } from "../lastSelection";

describe("the last chosen instance and environment", () => {
  beforeEach(() => window.localStorage.clear());

  it("comes back as written, and is null when nothing or junk is stored", () => {
    expect(readLastSelection()).toBeNull();
    writeLastSelection({ instance_id: "42", env_type: "test" });
    expect(readLastSelection()).toEqual({
      instance_id: "42",
      env_type: "test",
    });
    window.localStorage.setItem("grovs:last_selection", "{not json");
    expect(readLastSelection()).toBeNull();
    window.localStorage.setItem(
      "grovs:last_selection",
      JSON.stringify({ instance_id: 42 })
    );
    expect(readLastSelection()).toBeNull();
  });
});
