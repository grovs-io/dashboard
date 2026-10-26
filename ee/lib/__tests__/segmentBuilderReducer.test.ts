import { describe, expect, it } from "vitest";
import { createBuilderReducer } from "../segmentBuilderReducer";
import { emptyDefinition } from "../segments";
import { catalogue } from "./fixtures";

const reducer = createBuilderReducer({
  ...catalogue,
  limits: { ...catalogue.limits, groups: 2, conditions_per_group: 2 },
});

describe("segment builder reducer", () => {
  it("adds and removes groups within the limit", () => {
    let def = reducer(emptyDefinition(), { type: "addGroup" });
    expect(def.groups).toHaveLength(2);
    def = reducer(def, { type: "addGroup" });
    expect(def.groups).toHaveLength(2);
    def = reducer(def, { type: "removeGroup", group: 0 });
    expect(def.groups).toHaveLength(1);
  });

  it("sets operators", () => {
    let def = reducer(emptyDefinition(), {
      type: "setTopOperator",
      operator: "and",
    });
    expect(def.operator).toBe("and");
    def = reducer(def, { type: "setGroupOperator", group: 0, operator: "or" });
    expect(def.groups[0]!.operator).toBe("or");
  });

  it("adds conditions from the catalogue defaults and caps per group", () => {
    let def = reducer(emptyDefinition(), {
      type: "addCondition",
      group: 0,
      conditionType: "device",
    });
    expect(def.groups[0]!.conditions[0]).toEqual({
      type: "device",
      field: "platform",
      op: "is",
      value: [],
      mode: "current",
    });
    def = reducer(def, {
      type: "addCondition",
      group: 0,
      conditionType: "event",
    });
    def = reducer(def, {
      type: "addCondition",
      group: 0,
      conditionType: "event",
    });
    expect(def.groups[0]!.conditions).toHaveLength(2);
  });

  it("resets a condition when its type changes and keeps it when unchanged", () => {
    let def = reducer(emptyDefinition(), {
      type: "addCondition",
      group: 0,
      conditionType: "event",
    });
    def = reducer(def, {
      type: "patchCondition",
      group: 0,
      index: 0,
      condition: { type: "event", event_name: "signup" },
    });
    const same = reducer(def, {
      type: "setConditionType",
      group: 0,
      index: 0,
      conditionType: "event",
    });
    expect(same.groups[0]!.conditions[0]).toEqual({
      type: "event",
      event_name: "signup",
    });
    const changed = reducer(def, {
      type: "setConditionType",
      group: 0,
      index: 0,
      conditionType: "identifier",
    });
    expect(changed.groups[0]!.conditions[0]).toEqual({
      type: "identifier",
      op: "is_set",
    });
  });

  it("removes a condition and replaces the whole definition", () => {
    let def = reducer(emptyDefinition(), {
      type: "addCondition",
      group: 0,
      conditionType: "event",
    });
    def = reducer(def, { type: "removeCondition", group: 0, index: 0 });
    expect(def.groups[0]!.conditions).toEqual([]);
    const other = { version: 1 as const, operator: "and" as const, groups: [] };
    expect(reducer(def, { type: "replace", definition: other })).toBe(other);
  });
});
