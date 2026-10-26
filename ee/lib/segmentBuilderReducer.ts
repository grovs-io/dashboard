import { emptyCondition, emptyGroup } from "./segments";
import type {
  SegmentCatalogue,
  SegmentCondition,
  SegmentConditionType,
  SegmentDefinition,
  SegmentOperator,
} from "@ee/types/segments";

export type BuilderAction =
  | { type: "replace"; definition: SegmentDefinition }
  | { type: "setTopOperator"; operator: SegmentOperator }
  | { type: "addGroup" }
  | { type: "removeGroup"; group: number }
  | { type: "setGroupOperator"; group: number; operator: SegmentOperator }
  | { type: "addCondition"; group: number; conditionType: SegmentConditionType }
  | { type: "removeCondition"; group: number; index: number }
  | {
      type: "setConditionType";
      group: number;
      index: number;
      conditionType: SegmentConditionType;
    }
  | {
      type: "patchCondition";
      group: number;
      index: number;
      condition: SegmentCondition;
    };

export function createBuilderReducer(catalogue: SegmentCatalogue) {
  const { limits } = catalogue;
  const mapGroup = (
    def: SegmentDefinition,
    g: number,
    fn: (
      group: SegmentDefinition["groups"][number]
    ) => SegmentDefinition["groups"][number]
  ): SegmentDefinition => ({
    ...def,
    groups: def.groups.map((group, i) => (i === g ? fn(group) : group)),
  });
  return function reducer(
    def: SegmentDefinition,
    action: BuilderAction
  ): SegmentDefinition {
    switch (action.type) {
      case "replace":
        return action.definition;
      case "setTopOperator":
        return { ...def, operator: action.operator };
      case "addGroup":
        return def.groups.length >= limits.groups
          ? def
          : { ...def, groups: [...def.groups, emptyGroup()] };
      case "removeGroup":
        return {
          ...def,
          groups: def.groups.filter((_, i) => i !== action.group),
        };
      case "setGroupOperator":
        return mapGroup(def, action.group, (g) => ({
          ...g,
          operator: action.operator,
        }));
      case "addCondition":
        return mapGroup(def, action.group, (g) =>
          g.conditions.length >= limits.conditions_per_group
            ? g
            : {
                ...g,
                conditions: [
                  ...g.conditions,
                  emptyCondition(action.conditionType, catalogue),
                ],
              }
        );
      case "removeCondition":
        return mapGroup(def, action.group, (g) => ({
          ...g,
          conditions: g.conditions.filter((_, i) => i !== action.index),
        }));
      case "setConditionType":
        return mapGroup(def, action.group, (g) => ({
          ...g,
          conditions: g.conditions.map((c, i) =>
            i === action.index && c.type !== action.conditionType
              ? emptyCondition(action.conditionType, catalogue)
              : c
          ),
        }));
      case "patchCondition":
        return mapGroup(def, action.group, (g) => ({
          ...g,
          conditions: g.conditions.map((c, i) =>
            i === action.index ? action.condition : c
          ),
        }));
    }
  };
}
