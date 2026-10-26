import type { ApiError } from "@/lib/ApiError";
import type {
  CatalogueEntry,
  SegmentCatalogue,
  SegmentCondition,
  SegmentConditionType,
  SegmentDefinition,
  SegmentErrorCode,
  SegmentGroup,
  SegmentWindow,
} from "@ee/types/segments";
import { eventTypeLabel, fieldLabel, valueLabel } from "./segmentLabels";

export interface SegmentIssue {
  path: string;
  message: string;
}

const encoder = new TextEncoder();
export const byteLength = (value: string) => encoder.encode(value).length;

export function emptyDefinition(): SegmentDefinition {
  return { version: 1, operator: "or", groups: [emptyGroup()] };
}

export function emptyGroup(): SegmentGroup {
  return { operator: "and", conditions: [] };
}

export function catalogueEntry<T extends SegmentConditionType>(
  catalogue: SegmentCatalogue | undefined,
  type: T
): Extract<CatalogueEntry, { type: T }> | undefined {
  return catalogue?.conditions.find(
    (entry): entry is Extract<CatalogueEntry, { type: T }> =>
      entry.type === type
  );
}

export function emptyCondition(
  type: SegmentConditionType,
  catalogue?: SegmentCatalogue
): SegmentCondition {
  switch (type) {
    case "event":
      return { type, any: true, count: 1, window: { last_days: 30 } };
    case "device": {
      const entry = catalogueEntry(catalogue, "device");
      return {
        type,
        field: entry?.fields[0] ?? "platform",
        op: "is",
        value: [],
        mode: "current",
      };
    }
    case "profile":
      return { type, field: "properties.", op: "is", value: [] };
    case "first_seen":
      return { type, op: "gte", value: "" };
    case "identifier":
      return { type, op: "is_set" };
    case "acquisition":
      return {
        type,
        field: "tracking_source",
        op: "is",
        value: [],
        window: { last_days: 365 },
      };
    case "purchase":
      return { type, count: 1, window: { last_days: 90 } };
  }
}

export function windowCapDays(
  type: SegmentConditionType,
  catalogue?: SegmentCatalogue
): number {
  const entry = catalogue?.conditions.find((c) => c.type === type);
  if (entry && "max_window_days" in entry) return entry.max_window_days;
  return type === "acquisition" || type === "purchase" ? 365 : 90;
}

export function isNegative(condition: SegmentCondition): boolean {
  switch (condition.type) {
    case "event":
    case "purchase":
      return condition.negate === true;
    case "device":
      return condition.op === "is_not";
    case "profile":
      return condition.op === "is_not" || condition.op === "is_not_set";
    case "identifier":
      return condition.op === "is_not_set" || condition.op === "not_in_list";
    case "acquisition":
      return condition.op === "is_not";
    default:
      return false;
  }
}

// The API compiles a negative as EXCEPT against the group's positive set, so it needs an AND group with a positive.
export function negationAllowed(group: SegmentGroup): boolean {
  return (
    group.operator === "and" && group.conditions.some((c) => !isNegative(c))
  );
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function windowIssues(
  window: SegmentWindow | undefined,
  capDays: number,
  path: string,
  required: boolean,
  today: string
): SegmentIssue[] {
  if (!window)
    return required
      ? [{ path, message: "Pick a time window, such as the last 30 days." }]
      : [];
  if ("last_days" in window) {
    if (!Number.isInteger(window.last_days) || window.last_days < 1)
      return [{ path, message: "The time window must be at least 1 day." }];
    if (window.last_days > capDays)
      return [
        {
          path,
          message: `The time window can be at most ${capDays} days. Pick a shorter one.`,
        },
      ];
    return [];
  }
  if (!ISO_DATE.test(window.from) || !ISO_DATE.test(window.to))
    return [{ path, message: "Pick both dates of the time window." }];
  if (window.from > window.to)
    return [
      {
        path,
        message:
          "The time window starts after it ends. Pick a start before the end.",
      },
    ];
  if (window.from > today)
    return [
      {
        path,
        message:
          "The time window starts in the future. Pick a start up to today.",
      },
    ];
  const span =
    (Date.parse(window.to) - Date.parse(window.from)) / 86_400_000 + 1;
  if (span > capDays)
    return [
      {
        path,
        message: `The dates span more than ${capDays} days. Pick a shorter range.`,
      },
    ];
  return [];
}

function valueIssues(
  values: (string | number)[] | undefined,
  limits: SegmentCatalogue["limits"],
  path: string
): SegmentIssue[] {
  if (!values || values.length === 0)
    return [{ path, message: "Add at least one value." }];
  if (values.length > limits.values)
    return [
      {
        path,
        message: `Too many values: at most ${limits.values}. Remove some.`,
      },
    ];
  const tooLong = values.some(
    (v) =>
      typeof v === "string" &&
      (v.length === 0 || byteLength(v) > limits.value_bytes)
  );
  return tooLong
    ? [
        {
          path,
          message: `Each value needs some text and at most ${limits.value_bytes} bytes. Remove empty values and shorten long ones.`,
        },
      ]
    : [];
}

export function validateCondition(
  condition: SegmentCondition,
  group: SegmentGroup,
  catalogue: SegmentCatalogue,
  path: string,
  context: { today: string; hasIdentifierList: boolean }
): SegmentIssue[] {
  const issues: SegmentIssue[] = [];
  const { limits } = catalogue;
  if (isNegative(condition) && !negationAllowed(group)) {
    issues.push({
      path,
      message:
        'A "did not" or "is not" condition can\'t be on its own. Add a condition people do match to the same group, with the group set to ALL.',
    });
  }
  const cap = windowCapDays(condition.type, catalogue);
  switch (condition.type) {
    case "event": {
      const targets = [
        condition.event_type,
        condition.event_name,
        condition.any ? "any" : undefined,
      ].filter((t) => t !== undefined && t !== "");
      if (targets.length !== 1)
        issues.push({
          path,
          message:
            "Choose which event: any activity, a built-in event or a custom event.",
        });
      if (
        condition.count !== undefined &&
        (!Number.isInteger(condition.count) || condition.count < 1)
      )
        issues.push({ path, message: "The count must be 1 or more." });
      if ((condition.filters?.length ?? 0) > limits.filters)
        issues.push({
          path,
          message: `Too many filters: at most ${limits.filters}. Remove some.`,
        });
      condition.filters?.forEach((f, i) => {
        if (!f.field)
          issues.push({
            path: `${path}.filters.${i}`,
            message: "Choose what this filter checks.",
          });
        if (!f.value || byteLength(f.value) > limits.value_bytes)
          issues.push({
            path: `${path}.filters.${i}`,
            message: "Enter the value this filter matches.",
          });
      });
      issues.push(
        ...windowIssues(condition.window, cap, path, true, context.today)
      );
      break;
    }
    case "device": {
      if (!condition.field)
        issues.push({ path, message: "Choose which device detail to check." });
      issues.push(...valueIssues(condition.value, limits, path));
      if (condition.mode === "used")
        issues.push(
          ...windowIssues(condition.window, cap, path, true, context.today)
        );
      break;
    }
    case "profile": {
      const entry = catalogueEntry(catalogue, "profile");
      const prefix = entry?.property_prefix ?? "properties.";
      if (
        !condition.field.startsWith(prefix) ||
        condition.field.length <= prefix.length
      )
        issues.push({ path, message: "Choose the profile property to check." });
      if (condition.op !== "is_set" && condition.op !== "is_not_set")
        issues.push(...valueIssues(condition.value, limits, path));
      break;
    }
    case "first_seen":
      if (!ISO_DATE.test(condition.value))
        issues.push({ path, message: "Pick the first-seen date." });
      break;
    case "identifier": {
      if (condition.op === "is" || condition.op === "contains")
        issues.push(...valueIssues(condition.value, limits, path));
      if (
        (condition.op === "in_list" || condition.op === "not_in_list") &&
        !context.hasIdentifierList
      )
        issues.push({
          path,
          message:
            "This segment has no identifier list yet. Upload one in the Identifier list tab, then use this condition.",
        });
      break;
    }
    case "acquisition": {
      issues.push(...valueIssues(condition.value, limits, path));
      issues.push(
        ...windowIssues(condition.window, cap, path, false, context.today)
      );
      break;
    }
    case "purchase": {
      const entry = catalogueEntry(catalogue, "purchase");
      if (entry && !entry.enabled)
        issues.push({
          path,
          message:
            "Purchase conditions need revenue collection. Turn it on in Revenue first.",
        });
      if (
        condition.count !== undefined &&
        (!Number.isInteger(condition.count) || condition.count < 1)
      )
        issues.push({ path, message: "The count must be 1 or more." });
      if (
        condition.min_total_usd_cents !== undefined &&
        condition.min_total_usd_cents < 0
      )
        issues.push({ path, message: "The minimum total can't be negative." });
      issues.push(
        ...windowIssues(condition.window, cap, path, true, context.today)
      );
      break;
    }
  }
  return issues;
}

export function validateDefinition(
  definition: SegmentDefinition,
  catalogue: SegmentCatalogue,
  context: { today?: string; hasIdentifierList?: boolean } = {}
): SegmentIssue[] {
  const ctx = {
    today: context.today ?? new Date().toISOString().slice(0, 10),
    hasIdentifierList: context.hasIdentifierList ?? false,
  };
  const issues: SegmentIssue[] = [];
  const { limits } = catalogue;
  if (definition.groups.length === 0)
    issues.push({
      path: "groups",
      message: "Add at least one group of conditions.",
    });
  if (definition.groups.length > limits.groups)
    issues.push({
      path: "groups",
      message: `Too many groups: at most ${limits.groups}. Remove some.`,
    });
  definition.groups.forEach((group, g) => {
    const gp = `groups.${g}`;
    if (group.conditions.length === 0)
      issues.push({
        path: gp,
        message: "This group is empty. Add a condition, or remove the group.",
      });
    if (group.conditions.length > limits.conditions_per_group)
      issues.push({
        path: gp,
        message: `Too many conditions in this group: at most ${limits.conditions_per_group}. Move some to another group.`,
      });
    group.conditions.forEach((c, i) =>
      issues.push(
        ...validateCondition(c, group, catalogue, `${gp}.conditions.${i}`, ctx)
      )
    );
  });
  return issues;
}

// ANDs a condition onto the whole definition while keeping the user's existing logic.
export function withCondition(
  definition: SegmentDefinition,
  condition: SegmentCondition | undefined
): SegmentDefinition {
  if (!condition) return definition;
  const andable = (g: SegmentGroup) =>
    g.operator === "and" || g.conditions.length <= 1;
  const add = (g: SegmentGroup): SegmentGroup => ({
    operator: "and",
    conditions: [...g.conditions, condition],
  });
  const { groups } = definition;
  if (definition.operator === "and" || groups.length <= 1) {
    const i = groups.findIndex(andable);
    return {
      ...definition,
      operator: "and",
      groups:
        i < 0
          ? [...groups, { operator: "and", conditions: [condition] }]
          : groups.map((g, j) => (j === i ? add(g) : g)),
    };
  }
  // (G1 OR G2) AND c = (G1 AND c) OR (G2 AND c); OR groups split per condition first.
  return {
    ...definition,
    groups: groups
      .flatMap((g) =>
        andable(g)
          ? [g]
          : g.conditions.map((c) => ({
              operator: "and" as const,
              conditions: [c],
            }))
      )
      .map(add),
  };
}

// A 422 reads "Definition groups[0].conditions[2].value: …, Definition …"; the first path wins.
export function apiIssuePath(message: string): {
  path: string | null;
  message: string;
} {
  const match =
    /groups\[(\d+)\](?:\.conditions\[(\d+)\])?(?:\.[a-z_]+)*:\s*([^,]*(?:,(?!\s*(?:Definition\s+)?groups\[)[^,]*)*)/.exec(
      message
    );
  if (!match) return { path: null, message };
  const [, g, c, rest] = match;
  return {
    path: c === undefined ? `groups.${g}` : `groups.${g}.conditions.${c}`,
    message: (rest ?? "").trim() || message,
  };
}

const windowText = (window?: SegmentWindow) => {
  if (!window) return "";
  if ("last_days" in window) return ` in the last ${window.last_days} days`;
  return ` between ${window.from} and ${window.to}`;
};
const list = (field: string, values?: (string | number)[]) =>
  (values ?? []).map((v) => valueLabel(field, v)).join(", ");
const opText: Record<string, string> = {
  is: "is",
  is_not: "is not",
  contains: "contains",
  is_set: "is set",
  is_not_set: "is not set",
  in_list: "is in the uploaded list",
  not_in_list: "is not in the uploaded list",
  gte: "on or after",
  lte: "on or before",
};

export function describeCondition(condition: SegmentCondition): string {
  switch (condition.type) {
    case "event": {
      const target = condition.any
        ? "any activity"
        : condition.event_name
          ? condition.event_name
          : condition.event_type
            ? eventTypeLabel(condition.event_type).toLowerCase()
            : "an event";
      const count =
        condition.count && condition.count > 1
          ? ` at least ${condition.count} times`
          : "";
      const filters = condition.filters?.length
        ? ` where ${condition.filters.map((f) => `${fieldLabel(f.field).toLowerCase()} ${opText[f.op] ?? f.op} ${valueLabel(f.field, f.value)}`).join(" and ")}`
        : "";
      return `${condition.negate ? "Did not do" : "Did"} ${target}${count}${filters}${windowText(condition.window)}`;
    }
    case "device":
      return `${fieldLabel(condition.field)} ${opText[condition.op] ?? condition.op} ${list(condition.field, condition.value)} (${condition.mode === "used" ? `any device${windowText(condition.window)}` : "current device"})`;
    case "profile": {
      const key = fieldLabel(condition.field);
      return condition.op === "is_set" || condition.op === "is_not_set"
        ? `Profile ${key} ${opText[condition.op]}`
        : `Profile ${key} ${opText[condition.op] ?? condition.op} ${list(condition.field, condition.value)}`;
    }
    case "first_seen":
      return `First seen ${opText[condition.op]} ${condition.value}`;
    case "identifier":
      return condition.value?.length
        ? `Identifier ${opText[condition.op] ?? condition.op} ${list("sdk_identifier", condition.value)}`
        : `Identifier ${opText[condition.op] ?? condition.op}`;
    case "acquisition":
      return `Acquired via ${fieldLabel(condition.field).toLowerCase()} ${opText[condition.op] ?? condition.op} ${list(condition.field, condition.value)}${windowText(condition.window)}`;
    case "purchase": {
      const parts: string[] = [];
      if (condition.product_id?.length)
        parts.push(`product ${condition.product_id.join(", ")}`);
      if (condition.purchase_type?.length)
        parts.push(condition.purchase_type.join(", ").replace(/_/g, " "));
      if (condition.min_total_usd_cents)
        parts.push(
          `at least $${(condition.min_total_usd_cents / 100).toFixed(2)}`
        );
      const count =
        condition.count && condition.count > 1
          ? ` at least ${condition.count} times`
          : "";
      return `${condition.negate ? "Did not buy" : "Bought"}${parts.length ? ` ${parts.join(", ")}` : ""}${count}${windowText(condition.window)}`;
    }
  }
}

const errorMessages: Record<SegmentErrorCode, string> = {
  segment_busy: "Segments are busy right now. Retry in a moment.",
  query_too_heavy:
    "This segment is too heavy to compute. Narrow a window or remove a condition.",
  window_expired: "A window in this segment reaches past your data retention.",
  invalid_definition: "This segment's definition is invalid.",
  result_expired: "This result has expired. Reload to recompute it.",
  upload_in_progress:
    "Another upload for this segment is still running. Try again in a minute.",
  clickhouse_unavailable:
    "Segments are unavailable right now. Retry in a moment.",
};

// api.ts puts generic status copy in message; the backend's own text is on data.error (5xx bodies stay hidden).
export function backendMessage(error: ApiError): string {
  const body = error.data as { error?: unknown } | undefined;
  return error.status < 500 &&
    typeof body?.error === "string" &&
    body.error.trim()
    ? body.error
    : error.message;
}

export function segmentErrorMessage(
  code: string | undefined,
  fallback: string
): string {
  return code && code in errorMessages
    ? errorMessages[code as SegmentErrorCode]
    : fallback;
}
