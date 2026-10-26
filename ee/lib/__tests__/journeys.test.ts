import { describe, expect, it } from "vitest";
import { conversionOf } from "@ee/types/experiment";
import { JOURNEY_TEMPLATES } from "@ee/lib/journeyTemplates";
import { goalLabel } from "@ee/lib/inAppComposer";
import {
  launchSummary,
  sameJourney,
  conditionLabel,
  entryLabel,
  goalsLabel,
  continueAt,
  continueTargets,
  createStep,
  deleteStep,
  emptyJourney,
  evenPaths,
  highestStepId,
  lostSteps,
  waitsOn,
  insertStep,
  layout,
  pathGroupLabels,
  pointers,
  problems,
  setSplitMode,
  inAppDraftOf,
  inAppFields,
  journeyInput,
  stepsInput,
  pushFields,
  pushFormValues,
  setUntil,
  stepOrder,
  stepSummary,
  type LayoutLink,
} from "@ee/lib/journeys";
import type {
  JourneyEvent,
  JourneyInput,
  JourneyStep,
  PercentSplitStep,
  SplitStep,
  WaitStep,
} from "@ee/types/journey";
import { cartDraft, joinDraft, push } from "./journeyFixtures";

const next = (draft: JourneyInput, id: string) =>
  pointers(draft.steps[id]!).map((p) => p.target);

// The file's own helpers, reached through what the editor calls.
const newStepId = (steps: JourneyInput["steps"]) =>
  insertStep(
    { ...emptyJourney(), steps },
    { from: null, key: "first_step" },
    "wait"
  ).id;
const stepInput = (step: JourneyStep) =>
  stepsInput({ [step.id]: step })[step.id]!;
const eventInput = (event: JourneyEvent) =>
  journeyInput({ ...cartDraft(), entry: { ...cartDraft().entry, event } }).entry
    .event;

describe("newStepId", () => {
  it("never reuses an id the draft used before", () => {
    const one = {
      ...emptyJourney(),
      steps: { s1: push("s1") },
      first_step: "s1",
    };
    expect(insertStep(one, { from: "s1", key: "next" }, "wait", 5).id).toBe(
      "s6"
    );
    expect(highestStepId(["s3", "x", "s12"])).toBe(12);
  });

  it("never reuses an id in the map", () => {
    expect(newStepId({})).toBe("s1");
    expect(newStepId(cartDraft().steps)).toBe("s6");
    expect(newStepId({ s2: push("s2"), x: push("x") })).toBe("s3");
  });
});

describe("insertStep", () => {
  it("puts the first step in an empty journey", () => {
    const { draft, id } = insertStep(
      emptyJourney(),
      { from: null, key: "first_step" },
      "wait"
    );
    expect(draft.first_step).toBe(id);
    expect(next(draft, id)).toEqual([null]);
  });

  it("goes between two steps and continues to the old one", () => {
    const { draft, id } = insertStep(
      cartDraft(),
      { from: "s2", key: "next" },
      "set_attribute"
    );
    expect(next(draft, "s2")).toEqual([id]);
    expect(next(draft, id)).toEqual(["s3"]);
  });

  it("continues a new split from its Yes path", () => {
    const { draft, id } = insertStep(
      cartDraft(),
      { from: null, key: "first_step" },
      "split"
    );
    expect(draft.first_step).toBe(id);
    expect(next(draft, id)).toEqual(["s1", null]);
  });

  it("creates every type with fresh ids", () => {
    let draft = emptyJourney();
    const ids: string[] = [];
    for (const type of [
      "wait",
      "split",
      "push",
      "in_app",
      "set_attribute",
    ] as const) {
      const made = insertStep(draft, { from: null, key: "first_step" }, type);
      draft = made.draft;
      ids.push(made.id);
      expect(draft.steps[made.id]!.type).toBe(type);
    }
    expect(new Set(ids).size).toBe(5);
    expect(stepOrder(draft)).toEqual([...ids].reverse());
  });
});

describe("deleteStep", () => {
  it("lets a single-path step's next continue", () => {
    const draft = deleteStep(cartDraft(), "s2");
    expect(draft.steps.s2).toBeUndefined();
    expect(next(draft, "s1")).toEqual([null, "s3"]);
  });

  it("keeps the chosen branch and drops the other", () => {
    const draft = deleteStep(cartDraft(), "s1", "next");
    expect(draft.first_step).toBeNull();
    expect(draft.steps).toEqual({});
    const kept = deleteStep(cartDraft(), "s3", "timeout_next");
    expect(next(kept, "s2")).toEqual(["s4"]);
    expect(Object.keys(kept.steps).sort()).toEqual(["s1", "s2", "s4", "s5"]);
  });

  it("keeps a step another path still joins", () => {
    const draft = deleteStep(joinDraft(), "a", "no_next");
    expect(draft.first_step).toBe("c");
    expect(Object.keys(draft.steps).sort()).toEqual(["b", "c", "d"]);
  });

  it("stops a wait waiting on the removed push, and drops its Time ran out path", () => {
    const before = cartDraft();
    expect(waitsOn(before, "s2").map((s) => s.id)).toEqual(["s3"]);
    const draft = deleteStep(before, "s2");
    expect(draft.steps.s3).toMatchObject({ until: null, timeout_next: null });
    expect(Object.keys(draft.steps).sort()).toEqual(["s1", "s3"]);
    expect(lostSteps(before, draft)).toBe(3);
    expect(problems(draft).steps.s3).toBeUndefined();
  });

  it("points every parent of a join at what follows", () => {
    const draft = deleteStep(joinDraft(), "b");
    expect(next(draft, "a")).toEqual(["d", "c"]);
    expect(next(draft, "c")).toEqual(["d"]);
  });
});

describe("continue at", () => {
  it("offers only steps that would not loop back", () => {
    const draft = cartDraft();
    expect(continueTargets(draft, { from: "s3", key: "next" })).toEqual([
      "s4",
      "s5",
    ]);
    expect(continueTargets(draft, { from: "s5", key: "next" })).toEqual([]);
  });

  it("joins a path end to a step further down", () => {
    const draft = continueAt(cartDraft(), { from: "s1", key: "next" }, "s5")!;
    expect(next(draft, "s1")).toEqual(["s5", "s2"]);
  });

  it("refuses a loop", () => {
    expect(
      continueAt(cartDraft(), { from: "s5", key: "next" }, "s1")
    ).toBeNull();
    expect(
      continueAt(cartDraft(), { from: "s3", key: "next" }, "s3")
    ).toBeNull();
    expect(
      continueAt(cartDraft(), { from: "s3", key: "next" }, "nope")
    ).toBeNull();
  });
});

describe("branch edits", () => {
  it("drops the Time ran out path when the wait stops waiting for something", () => {
    const wait = setUntil(cartDraft().steps.s1 as WaitStep, null);
    expect(wait.timeout_next).toBeNull();
    expect(pointers(wait).map((p) => p.key)).toEqual(["next"]);
  });

  it("turns Yes/No into two paths and back", () => {
    const split = createStep("split", "x") as SplitStep;
    const percent = setSplitMode(
      { ...split, yes_next: "a", no_next: "b" } as SplitStep,
      "percent"
    );
    expect(percent).toMatchObject({
      paths: [
        { percent: 50, next: "a" },
        { percent: 50, next: "b" },
      ],
    });
    expect(setSplitMode(percent, "condition")).toMatchObject({
      yes_next: "a",
      no_next: "b",
    });
  });
});

describe("pathGroupLabels", () => {
  it("labels the paths' a/b/c groups the same way the steps table shows them", () => {
    const three: PercentSplitStep = {
      id: "x",
      type: "split",
      mode: "percent",
      paths: [
        { percent: 50, next: "b" },
        { percent: 30, next: "b" },
        { percent: 20, next: null },
      ],
    };
    expect(pathGroupLabels(three)).toEqual({
      a: "Path 1 · 50%",
      b: "Path 2 · 30%",
      c: "Path 3 · 20%",
    });
  });
});

describe("layout", () => {
  const find = (link: LayoutLink, id: string): LayoutLink | null => {
    if (link.target === id && link.node) return link;
    for (const l of link.node?.links ?? []) {
      const hit = find(l, id);
      if (hit) return hit;
    }
    return null;
  };

  it("draws a join once, under its first parent, and a chip under the other", () => {
    const root = layout(joinDraft());
    expect(root.node?.id).toBe("a");
    const [yes, no] = root.node!.links;
    expect(yes).toMatchObject({ label: "Yes", target: "b", join: null });
    expect(yes!.node!.links[0]!.node!.id).toBe("d");
    expect(no!.node!.id).toBe("c");
    expect(no!.node!.links[0]).toMatchObject({
      target: "b",
      node: null,
      join: "b",
    });
    expect(find(root, "d")).not.toBeNull();
  });

  it("ends a path with an empty link", () => {
    const root = layout(cartDraft());
    expect(root.node!.links[0]).toMatchObject({
      label: "Did it",
      target: null,
      node: null,
      join: null,
    });
    expect(layout(emptyJourney())).toMatchObject({ target: null, node: null });
  });
});

describe("problems", () => {
  it("passes a complete journey", () => {
    expect(problems(cartDraft())).toEqual({
      settings: [],
      entry: [],
      goals: [],
      overview: [],
      map: [],
      steps: {},
    });
  });

  it("names what the settings miss", () => {
    const found = problems({
      ...emptyJourney(),
      re_entry: { mode: "after_days", days: 0 },
      goals: [{ event: "", window_hours: 168 }],
      control_group: 60,
    }).settings;
    expect(found).toEqual([
      "Choose the event that starts the journey.",
      "Re-entry needs 1 to 365 days.",
      "Choose the event that counts as a conversion.",
      "The control group is 1% to 50%.",
      "Add at least one step.",
    ]);
    expect(
      problems({
        ...cartDraft(),
        entry: { ...cartDraft().entry, type: "segment" },
      }).settings
    ).toEqual(["Choose the segment people enter from."]);
  });

  it("checks each step the way the server does", () => {
    const draft = cartDraft();
    draft.steps.s1 = { ...(draft.steps.s1 as WaitStep), minutes: 2 };
    draft.steps.s2 = { ...push("s2", "s3"), title: "", image_url: "http://x" };
    draft.steps.s3 = {
      ...(draft.steps.s3 as WaitStep),
      until: { kind: "opened", step: "s5" },
    };
    draft.steps.s4 = {
      ...(draft.steps.s4 as Extract<typeof draft.steps.s4, { type: "in_app" }>),
      content: {},
      valid_days: 40,
    };
    draft.steps.s5 = {
      id: "s5",
      type: "set_attribute",
      key: "plan",
      value: "x",
      next: null,
    };
    expect(problems(draft).steps).toEqual({
      s1: ["Wait between 5 minutes and 30 days."],
      s2: ["Write a title.", "The image URL must start with https://"],
      s3: ["Choose a push step above this one."],
      s4: [
        "The message has no text yet. Add a title or a message.",
        "Keep it for 1 to 30 days.",
      ],
      s5: ["The key starts with journey_ and uses a-z, 0-9 and _ only."],
    });
  });

  it("checks splits", () => {
    const draft = joinDraft();
    draft.steps.a = {
      id: "a",
      type: "split",
      mode: "percent",
      paths: [
        { percent: 50, next: "b" },
        { percent: 40, next: "c" },
      ],
    };
    expect(problems(draft).steps.a).toEqual(["The paths must add up to 100%."]);
    draft.steps.a = {
      id: "a",
      type: "split",
      mode: "percent",
      paths: [
        { percent: 100, next: "b" },
        { percent: 0, next: "c" },
      ],
    };
    expect(problems(draft).steps.a).toEqual([
      "Each path is a whole percent, at least 1%.",
    ]);
    const three = evenPaths([
      { percent: 50, next: "b" },
      { percent: 50, next: "c" },
      { percent: 0, next: null },
    ]);
    expect(three.map((p) => p.percent)).toEqual([34, 33, 33]);
    draft.steps.a = { id: "a", type: "split", mode: "percent", paths: three };
    expect(problems(draft).steps.a).toBeUndefined();
    draft.steps.a = {
      id: "a",
      type: "split",
      mode: "condition",
      condition: { kind: "attribute", key: "", op: "eq", value: "" },
      yes_next: "b",
      no_next: "c",
    };
    expect(problems(draft).steps.a).toEqual([
      "Choose an attribute.",
      "Enter a value to compare with.",
    ]);
    // The API may send a number or a boolean back as the value.
    for (const value of [42, false, 0]) {
      draft.steps.a = {
        ...(draft.steps.a as SplitStep),
        condition: { kind: "attribute", key: "age", op: "gt", value },
      } as SplitStep;
      expect(problems(draft).steps.a).toBeUndefined();
    }
    const withNumber = {
      ...(draft.steps.a as SplitStep),
      condition: { kind: "attribute", key: "age", op: "gt", value: 42 },
    } as SplitStep;
    expect(stepSummary(draft, withNumber)).toBe("age is more than 42?");
  });

  it("refuses a loop even when it was not made here", () => {
    const draft = joinDraft();
    draft.steps.d = {
      ...(draft.steps.d as Extract<
        typeof draft.steps.d,
        { type: "set_attribute" }
      >),
      next: "a",
    };
    expect(problems(draft).settings).toContain(
      "The steps loop back on themselves."
    );
  });
});

describe("stepSummary", () => {
  it("says each step in one line", () => {
    const draft = cartDraft();
    expect(stepSummary(draft, draft.steps.s1!)).toBe(
      "Up to 2 hours, until checkout_completed"
    );
    expect(stepSummary(draft, draft.steps.s3!)).toBe(
      "Up to 1 day, until they open 2. Send push"
    );
    expect(stepSummary(draft, draft.steps.s4!)).toBe("Interstitial: 10% off");
    expect(stepSummary(draft, draft.steps.s5!)).toBe("journey_nudged = true");
    expect(stepSummary(joinDraft(), joinDraft().steps.a!)).toBe("On iOS?");
  });
});

describe("stepInput", () => {
  const keys = (step: object) => Object.keys(step).sort();

  it("sends only the contract's fields for each type", () => {
    const wait = setUntil(createStep("wait", "w") as WaitStep, {
      kind: "event",
      event: { name: "checkout", filters: [] },
    });
    expect(keys(stepInput(wait))).toEqual(
      ["id", "minutes", "next", "timeout_next", "type", "until"].sort()
    );

    const condition = createStep("split", "c") as SplitStep;
    expect(keys(stepInput(condition))).toEqual(
      ["condition", "id", "mode", "no_next", "type", "yes_next"].sort()
    );
    expect(keys(stepInput(setSplitMode(condition, "percent")))).toEqual(
      ["id", "mode", "paths", "type"].sort()
    );

    const base = createStep("push", "p") as Extract<
      JourneyInput["steps"][string],
      { type: "push" }
    >;
    const values = {
      ...pushFormValues(base),
      title: "Hi ",
      body: "There",
      linkId: 42,
    };
    const pushed = stepInput({
      ...base,
      ...pushFields(values),
      campaign_id: "pc1",
    });
    expect(keys(pushed)).toEqual(
      [
        "body",
        "data",
        "id",
        "image_url",
        "link_id",
        "next",
        "quiet_hours",
        "sound",
        "title",
        "type",
      ].sort()
    );
    expect(pushed).toMatchObject({ title: "Hi", link_id: 42 });

    const app = createStep("in_app", "i") as Extract<
      JourneyInput["steps"][string],
      { type: "in_app" }
    >;
    const edited = {
      ...app,
      ...inAppFields({ ...inAppDraftOf(app), title: "Hello" }),
    };
    expect(keys(stepInput({ ...edited, campaign_id: "ia1" }))).toEqual(
      [
        "caps",
        "content",
        "id",
        "next",
        "template",
        "triggers",
        "type",
        "valid_days",
      ].sort()
    );

    expect(keys(stepInput(createStep("set_attribute", "a")))).toEqual(
      ["id", "key", "next", "type", "value"].sort()
    );
  });

  it("keeps an in-app step's orientation through its draft", () => {
    const app = createStep("in_app", "i") as Extract<
      JourneyStep,
      { type: "in_app" }
    >;
    const portrait = {
      ...app,
      content: { ...app.content, orientation: "portrait" as const },
    };
    expect(inAppDraftOf(portrait).orientation).toBe("portrait");
    expect(inAppFields(inAppDraftOf(portrait)).content.orientation).toBe(
      "portrait"
    );
    expect(inAppDraftOf(app).orientation).toBe("any");
    expect(inAppFields(inAppDraftOf(app)).content).not.toHaveProperty(
      "orientation"
    );
  });

  it("drops the keys a step kept from an earlier shape", () => {
    const stale = {
      ...(createStep("wait", "w") as WaitStep),
      yes_next: "x",
      paths: [],
    } as unknown as WaitStep;
    const input = journeyInput({ ...cartDraft(), steps: { w: stale } });
    expect(Object.keys(input.steps.w!)).not.toContain("yes_next");
    expect(Object.keys(input.steps.w!)).not.toContain("paths");
  });
});

describe("ranges the server checks", () => {
  it("bounds split days, re-entry days and attribute keys", () => {
    const draft = joinDraft();
    draft.re_entry = { mode: "after_days", days: 400 };
    draft.steps.a = {
      id: "a",
      type: "split",
      mode: "condition",
      condition: {
        kind: "event",
        event: { name: "x", filters: [] },
        days: 91,
        min_count: 0,
      },
      yes_next: "b",
      no_next: "c",
    };
    const found = problems(draft);
    expect(found.settings).toContain("Re-entry needs 1 to 365 days.");
    expect(found.steps.a).toEqual([
      "Check 1 to 90 days back.",
      "The count is a whole number, 1 or more.",
    ]);
    draft.steps.a = {
      id: "a",
      type: "split",
      mode: "condition",
      condition: { kind: "attribute", key: "user.plan", op: "exists" },
      yes_next: "b",
      no_next: "c",
    };
    expect(problems(draft).steps.a).toEqual([
      "The attribute uses letters, digits and _ only, up to 64.",
    ]);
  });
});

describe("system events", () => {
  it("reads as plain sentences on the cards", () => {
    const draft = cartDraft();
    draft.entry = { ...draft.entry, event: { system: "install" } };
    expect(entryLabel(draft.entry)).toBe("When someone installs the app");
    const wait = setUntil(createStep("wait", "w") as WaitStep, {
      kind: "event",
      event: { system: "app_open" },
    });
    expect(stepSummary(draft, wait)).toBe(
      "Up to 1 hour, until they open the app"
    );
    expect(
      conditionLabel({
        kind: "event",
        event: { system: "reactivation" },
        days: 7,
        min_count: 1,
      })
    ).toBe("Did they come back in 7 days?");
    expect(goalsLabel({ goals: [{ system: "open", window_hours: 168 }] })).toBe(
      "Link opened"
    );
  });

  it("sends exactly one of system, screen or name, and no filters on a built-in event", () => {
    expect(
      eventInput({ system: "view", name: null, screen: null, filters: [] })
    ).toEqual({ system: "view" });
    const plan = { field: "plan", op: "eq", value: "pro" } as never;
    expect(eventInput({ screen: "Home", name: null, filters: [plan] })).toEqual(
      { screen: "Home", filters: [plan] }
    );
    expect(
      eventInput({ name: "buy", screen: null, system: null, filters: [] })
    ).toEqual({ name: "buy", filters: [] });
    const input = journeyInput({
      ...cartDraft(),
      entry: {
        ...cartDraft().entry,
        event: { system: "install", name: null, screen: null },
      },
    });
    expect(input.entry.event).toEqual({ system: "install" });
    const blank = { field: " ", op: "eq", value: "x" } as never;
    const dotted = { field: "user.plan", op: "eq", value: "x" } as never;
    expect(
      problems({
        ...cartDraft(),
        entry: {
          ...cartDraft().entry,
          event: { name: "buy", filters: [dotted] },
        },
      }).entry
    ).toEqual([
      "Filter 1: use letters, digits and _ only in the property name.",
    ]);
    expect(eventInput({ name: "buy", filters: [plan, blank] })).toEqual({
      name: "buy",
      filters: [plan],
    });
    expect(eventInput({ screen: "Home", filters: [blank] })).toEqual({
      screen: "Home",
      filters: [],
    });
    expect(problems(input).settings).toEqual([]);
  });

  it("counts a built-in goal the same way experiments do", () => {
    expect(conversionOf("system", "app_open", 72)).toEqual({
      system: "app_open",
      window_hours: 72,
    });
    expect(goalLabel({ system: "install", window_hours: 24 })).toBe(
      "App installed within 1 day"
    );
  });
});

describe("problem groups and changes", () => {
  it("files each problem where it is fixed", () => {
    const found = problems({
      ...emptyJourney(),
      goals: [{ event: "", window_hours: 168 }],
      control_group: 60,
      end_at: "2000-01-01T00:00:00Z",
    });
    expect(found.entry).toEqual(["Choose the event that starts the journey."]);
    expect(found.goals).toEqual([
      "Choose the event that counts as a conversion.",
    ]);
    expect(found.overview).toEqual([
      "The control group is 1% to 50%.",
      "The end date has passed.",
    ]);
    expect(found.map).toEqual(["Add at least one step."]);
    expect(
      problems({
        ...emptyJourney(),
        start_at: "2999-02-01T00:00:00Z",
        end_at: "2999-01-01T00:00:00Z",
      }).overview
    ).toEqual(["The end must be after the start."]);
  });

  it("tells a real change from the same journey with keys in another order", () => {
    const a = cartDraft();
    const b = JSON.parse(JSON.stringify(a));
    b.steps = Object.fromEntries(Object.entries(b.steps).reverse());
    expect(sameJourney(a, b)).toBe(true);
    b.steps.s2.title = "Changed";
    expect(sameJourney(a, b)).toBe(false);
  });
});

describe("templates", () => {
  it("gives Cart recovery its goal, and every template a first step", () => {
    const cart = JOURNEY_TEMPLATES.find((t) => t.id === "cart")!.draft();
    expect(cart.goals).toEqual([
      { event: "checkout_completed", window_hours: 168 },
    ]);
    for (const t of JOURNEY_TEMPLATES.filter((t) => t.id !== "blank"))
      expect(t.draft().steps[t.draft().first_step!]).toBeDefined();
  });
});

describe("launchSummary", () => {
  it("says what launching will do in one paragraph", () => {
    const welcome = JOURNEY_TEMPLATES.find((t) => t.id === "welcome")!.draft();
    expect(
      launchSummary(
        {
          ...welcome,
          goals: [{ system: "reinstall", window_hours: 168 }],
          control_group: 20,
        },
        () => null,
        2
      )
    ).toBe(
      "People enter when they install the app — everyone, once. They go through 4 steps and leave when they reinstall the app. 20% are held back as a control group (plus the project's 2%). It starts now and runs until you end it."
    );
    const winback = JOURNEY_TEMPLATES.find((t) => t.id === "winback")!.draft();
    const text = launchSummary(
      {
        ...winback,
        entry: {
          ...winback.entry,
          segment_id: "seg1",
          audience_segment_id: "seg2",
        },
        re_entry: { mode: "after_days", days: 30 },
        start_at: "2026-10-03T09:00:00",
        end_at: "2026-10-30T09:00:00",
      },
      (id) => (id === "seg1" ? "Lapsed users" : "Paying"),
      0
    );
    expect(text).toMatch(
      /^People enter when they join Lapsed users — only people in Paying, again after 30 days\. They go through 3 steps and leave at the end\. It starts on 3 Oct/
    );
    expect(text).toMatch(/and stops taking people on 30 Oct/);
    expect(text).not.toMatch(/control group/);
  });

  it("names the products of a purchase goal", () => {
    const welcome = JOURNEY_TEMPLATES.find((t) => t.id === "welcome")!.draft();
    const text = launchSummary(
      {
        ...welcome,
        goals: [{ purchase: true, products: ["premium"], window_hours: 72 }],
      },
      () => null,
      0
    );
    expect(text).toMatch(/leave when they make a purchase of premium\./);
  });
});

describe("purchase goals with 'only these products'", () => {
  const goal = {
    purchase: true as const,
    products: [],
    window_hours: 168 as const,
  };

  it("block launch until a product is chosen", () => {
    expect(problems({ ...cartDraft(), goals: [goal] }).goals).toContain(
      "Choose at least one product, or count any product."
    );
  });

  it("save as a draft without the empty product list", () => {
    expect(journeyInput({ ...cartDraft(), goals: [goal] }).goals).toEqual([
      { purchase: true, window_hours: 168 },
    ]);
  });
});

describe("percent splits after launch", () => {
  const split = (a: number, b: number) => ({
    ...cartDraft(),
    first_step: "s1",
    steps: {
      s1: {
        id: "s1",
        type: "split" as const,
        mode: "percent" as const,
        paths: [
          { percent: a, next: null },
          { percent: b, next: null },
        ],
      },
    },
  });

  it("may send everyone down one path once launched, but not in a draft", () => {
    expect(
      problems(split(0, 100), { launched: true }).steps.s1
    ).toBeUndefined();
    expect(problems(split(0, 100)).steps.s1).toContain(
      "Each path is a whole percent, at least 1%."
    );
  });
});
