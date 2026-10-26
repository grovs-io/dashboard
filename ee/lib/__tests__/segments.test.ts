import { catalogue } from "./fixtures";
import { ApiError } from "@/lib/ApiError";
import { describe, expect, it } from "vitest";
import {
  apiIssuePath,
  backendMessage,
  describeCondition,
  emptyCondition,
  emptyDefinition,
  negationAllowed,
  segmentErrorMessage,
  validateDefinition,
  windowCapDays,
  withCondition,
} from "../segments";
import type { SegmentCondition, SegmentDefinition } from "@ee/types/segments";

const today = "2026-09-23";
const def = (...conditions: SegmentCondition[]): SegmentDefinition => ({
  version: 1,
  operator: "or",
  groups: [{ operator: "and", conditions }],
});
const messages = (d: SegmentDefinition, ctx = {}) =>
  validateDefinition(d, catalogue, { today, ...ctx }).map((i) => i.message);

describe("validateDefinition", () => {
  it("accepts a plain activity condition", () => {
    expect(messages(def(emptyCondition("event", catalogue)))).toEqual([]);
  });

  it("enforces group and condition counts", () => {
    expect(messages({ version: 1, operator: "or", groups: [] })).toContain(
      "Add at least one group of conditions."
    );
    expect(messages(def())).toContain(
      "This group is empty. Add a condition, or remove the group."
    );
    const many: SegmentDefinition = {
      version: 1,
      operator: "or",
      groups: Array.from({ length: 6 }, () => ({
        operator: "and",
        conditions: [emptyCondition("event")],
      })),
    };
    expect(messages(many)).toContain(
      "Too many groups: at most 5. Remove some."
    );
  });

  it("requires exactly one event target", () => {
    expect(
      messages(def({ type: "event", any: true, event_name: "x" }))
    ).toContain(
      "Choose which event: any activity, a built-in event or a custom event."
    );
    expect(messages(def({ type: "event" }))).toContain(
      "Choose which event: any activity, a built-in event or a custom event."
    );
  });

  it("caps windows per type and refuses future fixed windows", () => {
    expect(
      messages(def({ type: "event", any: true, window: { last_days: 91 } }))
    ).toContain("The time window can be at most 90 days. Pick a shorter one.");
    expect(
      messages(
        def({
          type: "acquisition",
          field: "tracking_source",
          op: "is",
          value: ["email"],
          window: { last_days: 365 },
        })
      )
    ).toEqual([]);
    expect(
      messages(
        def({
          type: "event",
          any: true,
          window: { from: "2027-01-01", to: "2027-01-02" },
        })
      )
    ).toContain(
      "The time window starts in the future. Pick a start up to today."
    );
    expect(
      messages(
        def({
          type: "device",
          field: "os",
          op: "is",
          value: ["ios"],
          mode: "used",
        })
      )
    ).toContain("Pick a time window, such as the last 30 days.");
    expect(windowCapDays("purchase", catalogue)).toBe(365);
  });

  it("requires a window on event and purchase conditions, as the backend does", () => {
    expect(messages(def({ type: "event", any: true }))).toContain(
      "Pick a time window, such as the last 30 days."
    );
    expect(messages(def({ type: "purchase", count: 1 }))).toContain(
      "Pick a time window, such as the last 30 days."
    );
  });

  it("checks values: presence, count and byte length", () => {
    expect(
      messages(
        def({
          type: "device",
          field: "platform",
          op: "is",
          value: [],
          mode: "current",
        })
      )
    ).toContain("Add at least one value.");
    expect(
      messages(
        def({
          type: "device",
          field: "platform",
          op: "is",
          value: Array.from({ length: 101 }, (_, i) => `v${i}`),
          mode: "current",
        })
      )
    ).toContain("Too many values: at most 100. Remove some.");
    expect(
      messages(
        def({
          type: "device",
          field: "platform",
          op: "is",
          value: ["é".repeat(200)],
          mode: "current",
        })
      )
    ).toContain(
      "Each value needs some text and at most 256 bytes. Remove empty values and shorten long ones."
    );
    expect(
      messages(def({ type: "profile", field: "properties.plan", op: "is_set" }))
    ).toEqual([]);
  });

  it("allows negatives only in an AND group with a positive", () => {
    const negOnly = def({ type: "event", any: true, negate: true });
    expect(messages(negOnly)[0]).toMatch(/can't be on its own/);
    const withPositive = def(
      { type: "event", any: true, window: { last_days: 30 } },
      {
        type: "event",
        event_type: "view",
        negate: true,
        window: { last_days: 30 },
      }
    );
    expect(messages(withPositive)).toEqual([]);
    const orGroup: SegmentDefinition = {
      version: 1,
      operator: "or",
      groups: [
        { operator: "or", conditions: withPositive.groups[0]!.conditions },
      ],
    };
    expect(messages(orGroup)[0]).toMatch(/can't be on its own/);
    expect(
      negationAllowed({
        operator: "and",
        conditions: [{ type: "event", any: true }],
      })
    ).toBe(true);
  });

  it("gates in_list on an uploaded list and purchase on revenue collection", () => {
    expect(messages(def({ type: "identifier", op: "in_list" }))).toContain(
      "This segment has no identifier list yet. Upload one in the Identifier list tab, then use this condition."
    );
    expect(
      messages(def({ type: "identifier", op: "in_list" }), {
        hasIdentifierList: true,
      })
    ).toEqual([]);
    expect(
      messages(def({ type: "purchase", count: 1, window: { last_days: 30 } }))
    ).toContain(
      "Purchase conditions need revenue collection. Turn it on in Revenue first."
    );
  });
});

describe("describeCondition", () => {
  it("renders every type as a sentence", () => {
    expect(
      describeCondition({
        type: "event",
        event_name: "checkout",
        count: 3,
        window: { last_days: 30 },
        filters: [{ field: "properties.plan", op: "is", value: "pro" }],
      })
    ).toBe(
      "Did checkout at least 3 times where plan is pro in the last 30 days"
    );
    expect(
      describeCondition({
        type: "event",
        any: true,
        negate: true,
        window: { last_days: 7 },
      })
    ).toBe("Did not do any activity in the last 7 days");
    expect(
      describeCondition({
        type: "device",
        field: "platform",
        op: "is",
        value: ["ios", "android"],
        mode: "current",
      })
    ).toBe("Platform is iOS, Android (current device)");
    expect(
      describeCondition({
        type: "profile",
        field: "properties.plan",
        op: "is_not_set",
      })
    ).toBe("Profile plan is not set");
    expect(
      describeCondition({ type: "first_seen", op: "gte", value: "2026-01-01" })
    ).toBe("First seen on or after 2026-01-01");
    expect(describeCondition({ type: "identifier", op: "in_list" })).toBe(
      "Identifier is in the uploaded list"
    );
    expect(
      describeCondition({
        type: "acquisition",
        field: "campaign_id",
        op: "is",
        value: [41],
        window: { last_days: 365 },
      })
    ).toBe("Acquired via campaign is 41 in the last 365 days");
    expect(
      describeCondition({
        type: "purchase",
        product_id: ["pro"],
        min_total_usd_cents: 999,
        count: 2,
        window: { last_days: 90 },
      })
    ).toBe(
      "Bought product pro, at least $9.99 at least 2 times in the last 90 days"
    );
  });
});

describe("helpers", () => {
  it("maps API issue paths and error codes", () => {
    expect(apiIssuePath("groups[0].conditions[2]: value is required")).toEqual({
      path: "groups.0.conditions.2",
      message: "value is required",
    });
    expect(apiIssuePath("groups[1]: too many")).toEqual({
      path: "groups.1",
      message: "too many",
    });
    expect(apiIssuePath("Name can't be blank")).toEqual({
      path: null,
      message: "Name can't be blank",
    });
    expect(segmentErrorMessage("segment_busy", "x")).toMatch(/Retry/);
    expect(segmentErrorMessage("nope", "fallback")).toBe("fallback");
  });

  it("reads the backend's error text, not api.ts's generic message", () => {
    const generic = "The provided data is invalid.";
    expect(
      backendMessage(
        new ApiError(generic, 422, undefined, { error: "Bad list" })
      )
    ).toBe("Bad list");
    expect(backendMessage(new ApiError(generic, 422))).toBe(generic);
    expect(
      backendMessage(
        new ApiError("Server error. Please try again later.", 500, undefined, {
          error: "PG::Error stack",
        })
      )
    ).toBe("Server error. Please try again later.");
  });

  it("starts with one empty AND group under OR", () => {
    expect(emptyDefinition()).toEqual({
      version: 1,
      operator: "or",
      groups: [{ operator: "and", conditions: [] }],
    });
  });
});

describe("withCondition", () => {
  const a: SegmentCondition = { type: "identifier", op: "is_set" };
  const b: SegmentCondition = { type: "first_seen", op: "gte", value: "x" };
  const c: SegmentCondition = { type: "profile", field: "p.x", op: "is_set" };
  const list: SegmentCondition = { type: "identifier", op: "in_list" };

  it("appends to a single AND group", () => {
    expect(withCondition(def(a, b), list).groups).toEqual([
      { operator: "and", conditions: [a, b, list] },
    ]);
  });

  it("keeps an OR group's logic: (A OR B) AND list", () => {
    const d: SegmentDefinition = {
      version: 1,
      operator: "or",
      groups: [{ operator: "or", conditions: [a, b] }],
    };
    expect(withCondition(d, list)).toEqual({
      version: 1,
      operator: "and",
      groups: [
        { operator: "or", conditions: [a, b] },
        { operator: "and", conditions: [list] },
      ],
    });
  });

  it("distributes over OR'd groups: (A OR (B AND C)) AND list", () => {
    const d: SegmentDefinition = {
      version: 1,
      operator: "or",
      groups: [
        { operator: "or", conditions: [a, b] },
        { operator: "and", conditions: [b, c] },
      ],
    };
    expect(withCondition(d, list)).toEqual({
      version: 1,
      operator: "or",
      groups: [
        { operator: "and", conditions: [a, list] },
        { operator: "and", conditions: [b, list] },
        { operator: "and", conditions: [b, c, list] },
      ],
    });
  });

  it("adds to an AND group under a top-level AND", () => {
    const d: SegmentDefinition = {
      version: 1,
      operator: "and",
      groups: [
        { operator: "or", conditions: [a, b] },
        { operator: "and", conditions: [c] },
      ],
    };
    expect(withCondition(d, list).groups).toEqual([
      { operator: "or", conditions: [a, b] },
      { operator: "and", conditions: [c, list] },
    ]);
  });
});
