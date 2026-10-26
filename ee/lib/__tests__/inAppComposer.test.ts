import { describe, expect, it } from "vitest";
import {
  addVariant,
  bracesProblem,
  charCount,
  contentProblems,
  draftWarnings,
  draftFromCampaign,
  draftInput,
  draftProblems,
  COLOR_THEMES,
  delayLabel,
  updateDraft,
  emptyDraft,
  isColor,
  isDark,
  sameColors,
  fieldText,
  insertAt,
  usableKey,
  firstProblemSection,
  fromLocalInput,
  hasProblems,
  linkProblem,
  nextButtonId,
  newOptionId,
  mirrorQuestion,
  nextVariantId,
  patchVariant,
  problemVariant,
  removeVariant,
  variantContent,
  withVariant,
  goalLabel,
  blankQuestion,
  starsLabel,
  questionSentences,
  questionTemplateReason,
  quickQuestionDraft,
  rateDraft,
  toLocalInput,
  type DraftQuestion,
  type InAppDraft,
} from "../inAppComposer";
import { IN_APP_TEMPLATES, type InAppQuestion } from "@ee/types/inApp";
import {
  experimentCampaign,
  inAppCampaign,
  questionCampaign,
  starsQuestion,
} from "./inAppFixtures";

const ready = (over: Partial<InAppDraft> = {}): InAppDraft => ({
  ...emptyDraft(),
  name: "Autumn sale",
  title: "Hello",
  ...over,
});

describe("draftInput", () => {
  it("sends the whole definition a device needs", () => {
    const input = draftInput(ready({ message: " Welcome " }), {
      withAudience: true,
    });
    expect(input).toMatchObject({
      name: "Autumn sale",
      template: "interstitial",
      content: {
        title: "Hello",
        message: "Welcome",
        image: { portrait: null, landscape: null },
        colors: {},
        close_button: true,
        backdrop: "dim",
        buttons: [],
        tap_action: null,
      },
      triggers: [{ type: "app_open" }],
      conditions: [],
      schedule: { days: null, from: null, to: null },
      priority: 1,
      delay_seconds: 0,
      start_at: null,
      end_at: null,
      audience: { type: "all" },
    });
  });

  it("uses the title, then the first line of the message, as the name", () => {
    const name = (over: Partial<InAppDraft>) =>
      draftInput({ ...emptyDraft(), ...over }, { withAudience: true }).name;
    expect(name({})).toBe("Untitled message");
    expect(name({ title: " Hello ", message: "Welcome" })).toBe("Hello");
    expect(name({ message: "First line\nSecond" })).toBe("First line");
    expect(name({ name: " Mine ", title: "Hello" })).toBe("Mine");
    expect(name({ title: "x".repeat(300) })).toHaveLength(255);
    expect(
      name({ title: 'Hi {{ user.first_name | default: "there" }}, welcome' })
    ).toBe("Hi there, welcome");
    expect(name({ title: "{{ user.first_name }}", message: "Body" })).toBe(
      "Body"
    );
  });

  it("leaves the audience out once it is frozen", () => {
    expect(draftInput(ready(), { withAudience: false })).not.toHaveProperty(
      "audience"
    );
  });

  it("leaves out a segment audience with no segment chosen", () => {
    const input = draftInput(ready({ audience: { type: "segment" } }), {
      withAudience: true,
    });
    expect(input).not.toHaveProperty("audience");
    expect(
      draftInput(ready({ audience: { type: "segment", segmentId: "s1" } }), {
        withAudience: true,
      }).audience
    ).toEqual({ type: "segment", segment_id: "s1" });
  });

  it("an image template carries no text and no buttons", () => {
    const input = draftInput(
      ready({
        template: "cover_image",
        message: "Ignored",
        image: { portrait: "https://cdn.example/a.png", landscape: null },
        buttons: [{ id: "button_1", text: "Go", action: { type: "close" } }],
      }),
      { withAudience: true }
    );
    expect(input.content).toMatchObject({
      title: null,
      message: null,
      buttons: [],
      image: { portrait: "https://cdn.example/a.png", landscape: null },
    });
  });

  it("an alert carries no image and a banner never dims", () => {
    const image = { portrait: "https://cdn.example/a.png", landscape: null };
    expect(
      draftInput(ready({ template: "alert", image }), { withAudience: true })
        .content?.image
    ).toEqual({ portrait: null, landscape: null });
    expect(
      draftInput(ready({ template: "header" }), { withAudience: true }).content
        ?.backdrop
    ).toBe("none");
  });

  it("keeps only what each action needs", () => {
    const input = draftInput(
      ready({
        buttons: [
          {
            id: "button_1",
            text: " Shop ",
            action: {
              type: "open_url",
              url: " https://a.example ",
              payload: { a: "b" },
            },
            colors: { background: "", text: "#FFFFFF" },
          },
          {
            id: "button_2",
            text: "Later",
            action: { type: "close", url: "https://left.over" },
          },
        ],
        tapAction: { type: "key_value", payload: { screen: "offers" } },
      }),
      { withAudience: true }
    );
    expect(input.content?.buttons).toEqual([
      {
        id: "button_1",
        text: "Shop",
        action: { type: "open_url", url: "https://a.example" },
        colors: { text: "#FFFFFF" },
      },
      { id: "button_2", text: "Later", action: { type: "close" } },
    ]);
    expect(input.content?.tap_action).toEqual({
      type: "key_value",
      payload: { screen: "offers" },
    });
  });

  it("cleans triggers: no empty screen name, no empty filter list", () => {
    const input = draftInput(
      ready({
        triggers: [
          { type: "screen_view", name: "  " },
          { type: "screen_view", name: " Checkout " },
          { type: "event", name: " cart_viewed ", filters: [] },
          {
            type: "event",
            name: "paid",
            filters: [{ field: "total", op: "gt", value: 10 }],
          },
        ],
      }),
      { withAudience: true }
    );
    expect(input.triggers).toEqual([
      { type: "screen_view" },
      { type: "screen_view", name: "Checkout" },
      { type: "event", name: "cart_viewed" },
      {
        type: "event",
        name: "paid",
        filters: [{ field: "total", op: "gt", value: 10 }],
      },
    ]);
  });

  it("sorts the days, and sends hours only as a pair", () => {
    expect(
      draftInput(ready({ days: [5, 1, 3], from: "09:00", to: "" }), {
        withAudience: true,
      }).schedule
    ).toEqual({ days: [1, 3, 5], from: null, to: null });
    expect(
      draftInput(ready({ from: "09:00", to: "21:00" }), { withAudience: true })
        .schedule
    ).toEqual({ days: null, from: "09:00", to: "21:00" });
  });

  it("turns a first seen date into the instant the day starts", () => {
    const input = draftInput(
      ready({
        conditions: [
          { type: "first_seen", op: "before", value: "2026-09-01" },
          { type: "first_seen", op: "within_days", value: 7 },
          { type: "first_seen", op: "after", value: "2026-09-01T00:00:00Z" },
        ],
      }),
      { withAudience: true }
    );
    expect(input.conditions?.map((c) => c.value)).toEqual([
      "2026-09-01T00:00:00Z",
      7,
      "2026-09-01T00:00:00Z",
    ]);
  });

  it("sends the start and end as instants", () => {
    const input = draftInput(ready({ startAt: "2030-01-01T09:00" }), {
      withAudience: true,
    });
    expect(input.start_at).toBe(new Date("2030-01-01T09:00").toISOString());
  });
});

describe("draftFromCampaign", () => {
  it("keeps the delay and whether it can be dismissed", () => {
    const draft = draftFromCampaign(
      inAppCampaign({
        delay_seconds: 5,
        content: {
          title: "Hi",
          dismissible: false,
          tap_action: { type: "close" },
        },
      })
    );
    const input = draftInput(draft, { withAudience: true });
    expect(input.delay_seconds).toBe(5);
    expect(input.content?.dismissible).toBe(false);
  });

  it("survives a round trip through the API shape", () => {
    const campaign = inAppCampaign({
      content: {
        title: "Hello",
        message: "Welcome",
        image: { portrait: "https://cdn.example/a.png", landscape: null },
        colors: { background: "#FFFFFF" },
        close_button: false,
        backdrop: "none",
        buttons: [{ id: "shop", text: "Shop", action: { type: "close" } }],
        tap_action: null,
      },
      caps: {
        session: 1,
        day: 2,
        week: null,
        lifetime: 3,
        ignore_global: true,
      },
      schedule: { days: [1, 2], from: "09:00", to: "21:00" },
      start_at: "2030-01-01T09:00:00.000Z",
      end_at: "2030-02-01T09:00:00.000Z",
      delay_seconds: 0,
    });
    const input = draftInput(draftFromCampaign(campaign), {
      withAudience: true,
    });
    expect(input).toMatchObject({
      name: campaign.name,
      template: campaign.template,
      content: campaign.content,
      triggers: campaign.triggers,
      caps: campaign.caps,
      schedule: campaign.schedule,
      priority: 4,
      delay_seconds: 0,
      start_at: campaign.start_at,
      end_at: campaign.end_at,
    });
  });

  it("reads the orientation and sends it with every variant", () => {
    const draft = draftFromCampaign(
      experimentCampaign({
        content: { title: "Hi", orientation: "portrait" },
      })
    );
    expect(draft.orientation).toBe("portrait");
    const input = draftInput(draft, { withAudience: true });
    expect(input.content?.orientation).toBe("portrait");
    expect(input.variants?.[0]?.content.orientation).toBe("portrait");
  });

  it("leaves out any orientation, which is the default", () => {
    const draft = draftFromCampaign(inAppCampaign());
    expect(draft.orientation).toBe("any");
    const input = draftInput(draft, { withAudience: true });
    expect(input.content).not.toHaveProperty("orientation");
    expect(
      draftInput(
        {
          ...draft,
          template: "html",
          html: "<p>Hi</p>",
          orientation: "landscape",
        },
        { withAudience: true }
      ).content?.orientation
    ).toBe("landscape");
  });

  it("fills what an incomplete draft lacks", () => {
    const draft = draftFromCampaign(
      inAppCampaign({ content: {}, caps: {}, schedule: {} })
    );
    expect(draft.title).toBe("");
    expect(draft.image).toEqual({ portrait: null, landscape: null });
    expect(draft.caps).toEqual({
      session: null,
      day: null,
      week: null,
      lifetime: null,
      ignore_global: false,
    });
    expect(draft.days).toEqual([]);
    expect(draft.closeButton).toBe(true);
  });

  it("reads a segment audience", () => {
    const draft = draftFromCampaign(
      inAppCampaign({
        audience: {
          type: "segment",
          segment_id: "s1",
          segment_definition_hash: "h",
          segment_changed: false,
        },
      })
    );
    expect(draft.audience).toEqual({ type: "segment", segmentId: "s1" });
  });
});

describe("draftProblems", () => {
  it("finds nothing wrong with a ready draft", () => {
    expect(hasProblems(draftProblems(ready()))).toBe(false);
    expect(firstProblemSection(draftProblems(ready()))).toBeNull();
  });

  it("an empty draft needs some text, and no name", () => {
    const problems = draftProblems(emptyDraft());
    expect(problems.message).toEqual([
      "The message has no text yet. Add a title or a message.",
    ]);
    expect(firstProblemSection(problems)).toBe("message");
  });

  it("an image template needs its portrait image, not text", () => {
    expect(
      draftProblems(ready({ template: "cover_image", title: "" })).message
    ).toEqual(["This template shows only an image. Upload a portrait image."]);
  });

  it("names the button that is wrong", () => {
    const problems = draftProblems(
      ready({
        buttons: [
          { id: "button_1", text: "", action: { type: "close" } },
          { id: "button_2", text: "Go", action: { type: "open_url", url: "" } },
        ],
        tapAction: { type: "open_url", url: "javascript:alert(1)" },
      })
    );
    expect(problems.message).toEqual([
      "Button 1 has no label. Type the text people will tap.",
      "Button 2: Add the link it opens, such as https://example.com/offer.",
      "Tap on the message: javascript:, data:, file: and blob: links can't be used. Use an https:// or app link.",
    ]);
  });

  it("ignores buttons an image template will not send", () => {
    const problems = draftProblems(
      ready({
        template: "cover_image",
        image: { portrait: "https://cdn.example/a.png", landscape: null },
        buttons: [{ id: "button_1", text: "", action: { type: "close" } }],
      })
    );
    expect(problems.message).toEqual([]);
  });

  it("needs a trigger, an event name and a property per filter", () => {
    expect(draftProblems(ready({ triggers: [] })).trigger).toEqual([
      "Choose when the message shows: add at least one trigger.",
    ]);
    expect(
      draftProblems(
        ready({
          triggers: [
            { type: "app_open" },
            {
              type: "event",
              name: " ",
              filters: [{ field: "", op: "is_set" }],
            },
          ],
        })
      ).trigger
    ).toEqual([
      "Trigger 2: choose the event that shows the message.",
      "Trigger 2: a filter has no property. Pick one or remove the filter.",
    ]);
  });

  it("needs a segment, and a name or key on the conditions that take one", () => {
    const problems = draftProblems(
      ready({
        audience: { type: "segment" },
        conditions: [
          { type: "platform", op: "eq", value: "ios" },
          { type: "event_count", op: "gt", name: "", value: 1 },
          { type: "user_attribute", op: "is_set", key: " " },
        ],
      })
    );
    expect(problems.audience).toEqual([
      "Pick the segment to show it to, or choose Everyone.",
      "Audience condition 2: choose an event.",
      "Audience condition 3: choose an attribute.",
    ]);
  });

  it("the end is after the start, hours come as a pair, caps stay in range", () => {
    const problems = draftProblems(
      ready({
        startAt: "2030-01-02T09:00",
        endAt: "2030-01-01T09:00",
        from: "09:00",
        caps: { ...emptyDraft().caps, day: 21 },
      })
    );
    expect(problems.limits).toEqual([
      "The end is before the start. Pick an end after the start.",
      "Set both the From and To hours, or choose All day.",
      "At most 20 per day. Lower the per day limit.",
    ]);
    expect(firstProblemSection(problems)).toBe("limits");
  });

  it("keeps alert text short, and only alert text", () => {
    const long = {
      title: "t".repeat(81),
      message: "m".repeat(301),
      buttons: [
        { id: "button_1", text: "b".repeat(31), action: { type: "close" } },
      ],
    } satisfies Partial<InAppDraft>;
    expect(
      draftProblems(ready({ template: "alert", ...long })).message
    ).toEqual([
      "The alert title is too long: it can have at most 80 characters.",
      "The alert message is too long: it can have at most 300 characters.",
      "Button 1: the label is too long, an alert button can have at most 30 characters.",
    ]);
    expect(
      draftProblems(
        ready({
          template: "alert",
          title: "t".repeat(80),
          message: "m".repeat(300),
          buttons: [
            { id: "button_1", text: "b".repeat(30), action: { type: "close" } },
          ],
        })
      ).message
    ).toEqual([]);
    expect(
      draftProblems(ready({ template: "interstitial", ...long })).message
    ).toEqual([]);
    expect(
      draftProblems(
        patchVariant(addVariant(ready({ template: "alert" })), "b", {
          title: "t".repeat(81),
        })
      ).message
    ).toEqual([
      "Variant B: The alert title is too long: it can have at most 80 characters.",
    ]);
  });

  it("counts alert text in characters, as the server does", () => {
    const party = "b".repeat(29) + "🎉";
    expect(party.length).toBe(31);
    expect(charCount(party)).toBe(30);
    expect(charCount(`  ${party}  `)).toBe(30); // trimmed, as it is sent
    const at = (title: string, message: string, label: string) =>
      draftProblems(
        ready({
          template: "alert",
          title,
          message,
          buttons: [{ id: "button_1", text: label, action: { type: "close" } }],
        })
      ).message;
    expect(at("t".repeat(79) + "🎉", "m".repeat(299) + "🎉", party)).toEqual(
      []
    );
    expect(
      at("t".repeat(80) + "🎉", "m".repeat(300) + "🎉", party + "🎉")
    ).toEqual([
      "The alert title is too long: it can have at most 80 characters.",
      "The alert message is too long: it can have at most 300 characters.",
      "Button 1: the label is too long, an alert button can have at most 30 characters.",
    ]);
  });

  it("an end in the past is refused when there is no start", () => {
    expect(draftProblems(ready({ endAt: "2020-01-01T09:00" })).limits).toEqual([
      "The end date has already passed. Pick a later end, or Until I end it.",
    ]);
  });
});

describe("links and fields", () => {
  it.each([
    ["https://a.example/x", null],
    ["myapp://offer/{{ event.id }}", null],
    ["", "Add the link it opens, such as https://example.com/offer."],
    [
      "a.example",
      "The link must start with https://, http:// or your app's scheme, such as myapp://.",
    ],
    [
      "JavaScript:alert(1)",
      "javascript:, data:, file: and blob: links can't be used. Use an https:// or app link.",
    ],
    [
      "data:text/html,x",
      "javascript:, data:, file: and blob: links can't be used. Use an https:// or app link.",
    ],
    [
      "https://{{ user.host }}/x",
      "A personalised value can only go after the domain, after the first /.",
    ],
  ])("%s", (url, expected) => {
    expect(linkProblem(url)).toBe(expected);
  });

  it.each([
    ["Hi {{ user.first_name }}", true],
    ['Hi {{user.first_name|default:"there"}}', true],
    ["Hi {{ event.total }} and {{ user.plan }}", true],
    ["Hi {{ user.first-name }}", false],
    ["Hi {{ user.name | default: 'there' }}", false],
    ["Hi {{ name }}", false],
    ["Hi {{", false],
    ["Plain text with } braces {", true],
  ])("%s", (text, fine) => {
    expect(bracesProblem(text) === null).toBe(fine);
  });
});

describe("inserting a value", () => {
  it("writes the field with and without a fallback", () => {
    expect(fieldText("user", "first_name", "there")).toBe(
      '{{ user.first_name | default: "there" }}'
    );
    expect(fieldText("event", "total", " ")).toBe("{{ event.total }}");
  });

  it("a fallback can never break the field it sits in", () => {
    const field = fieldText("user", "name", 'my "friend" {{x}}');
    expect(field).toBe('{{ user.name | default: "my friend x" }}');
    expect(bracesProblem(`Hi ${field}`)).toBeNull();
  });

  it("goes where the cursor is, and replaces what is selected", () => {
    expect(insertAt("Hi !", "X", 3, 3)).toBe("Hi X!");
    expect(insertAt("Hi NAME!", "X", 3, 7)).toBe("Hi X!");
    expect(insertAt("Hi", "X", null, null)).toBe("HiX");
    expect(insertAt("Hi", "X", 99, 120)).toBe("HiX");
  });

  it("offers only keys a device can read", () => {
    expect(["plan", "first_name", "a-b", "a.b", ""].filter(usableKey)).toEqual([
      "plan",
      "first_name",
    ]);
  });
});

describe("colours", () => {
  it("knows a colour a device can read", () => {
    expect(
      ["#FFFFFF", "#ffffffAA", "#FFF", "red", "#GGGGGG", ""].filter(isColor)
    ).toEqual(["#FFFFFF", "#ffffffAA"]);
  });

  it("tells a dark background from a light one", () => {
    expect(isDark("#111827")).toBe(true);
    expect(isDark("#2A86FF")).toBe(true);
    expect(isDark("#FFE08A")).toBe(false);
    expect(isDark("#FFFFFF")).toBe(false);
  });

  it("drops a colour that is not one instead of sending it", () => {
    const input = draftInput(
      ready({ colors: { background: "#12", title: "#FF0000" } }),
      { withAudience: true }
    );
    expect(input.content?.colors).toEqual({ title: "#FF0000" });
  });

  it("every theme holds only readable colours", () => {
    for (const theme of COLOR_THEMES)
      for (const color of [
        ...Object.values(theme.colors),
        ...Object.values(theme.button(0)),
        ...Object.values(theme.button(1)),
      ])
        expect(isColor(color ?? "")).toBe(true);
  });

  it("compares colours whatever their letter case", () => {
    expect(sameColors({ a: "#ffffff" }, { a: "#FFFFFF" })).toBe(true);
    expect(sameColors({}, { a: undefined })).toBe(true);
    expect(sameColors({ a: "#FFFFFF" }, {})).toBe(false);
  });
});

describe("what must be answered", () => {
  const stuck =
    'People have no way to close this message. Add a button or a tap action, or turn on "People can close it without answering".';

  it("a message nobody can close needs something to tap", () => {
    expect(draftProblems(ready({ dismissible: false })).message).toEqual([
      stuck,
    ]);
    const button = {
      id: "b",
      text: "Update",
      action: { type: "open_store" as const },
    };
    expect(
      draftProblems(ready({ dismissible: false, buttons: [button] })).message
    ).toEqual([]);
    expect(
      draftProblems(ready({ dismissible: false, tapAction: { type: "close" } }))
        .message
    ).toEqual([]);
  });

  it("buttons an image template will not send do not count", () => {
    const button = {
      id: "b",
      text: "Update",
      action: { type: "close" as const },
    };
    const image = { portrait: "https://cdn.example/a.png", landscape: null };
    expect(
      draftProblems(
        ready({
          template: "cover_image",
          image,
          dismissible: false,
          buttons: [button],
        })
      ).message
    ).toEqual([stuck]);
  });

  it("the update message starts ready, except for the version only you know", () => {
    const draft = updateDraft();
    const problems = draftProblems(draft);
    expect(problems.message).toEqual([]);
    expect(problems.audience).toEqual([
      "Audience condition 1: enter a version, such as 2.1.0.",
    ]);
    const input = draftInput(
      {
        ...draft,
        conditions: [{ type: "app_version", op: "lt", value: "2.1.0" }],
      },
      { withAudience: true }
    );
    expect(input).toMatchObject({
      priority: 10,
      triggers: [{ type: "app_open" }],
      caps: { session: 1, ignore_global: true },
      conditions: [{ type: "app_version", op: "lt", value: "2.1.0" }],
    });
    expect(input.content?.buttons?.[0]).toEqual({
      id: "update",
      text: "Update",
      action: { type: "open_store" },
    });
  });

  it("says a delay in words", () => {
    expect([0, 1, 5, 60, 120].map(delayLabel)).toEqual([
      "Right away",
      "After 1 second",
      "After 5 seconds",
      "After 1 minute",
      "After 2 minutes",
    ]);
  });
});

describe("helpers", () => {
  it("gives the next free button id", () => {
    expect(nextButtonId([])).toBe("button_1");
    expect(
      nextButtonId([
        { id: "button_1", text: "", action: { type: "close" } },
        { id: "button_3", text: "", action: { type: "close" } },
      ])
    ).toBe("button_2");
  });

  it("moves between an instant and a local input and back", () => {
    const iso = "2030-01-01T09:00:00.000Z";
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(toLocalInput(null)).toBe("");
    expect(toLocalInput("nonsense")).toBe("");
    expect(fromLocalInput("")).toBeNull();
    expect(fromLocalInput("nonsense")).toBeNull();
  });
});

const asking = (
  question: Partial<DraftQuestion> = {},
  over: Partial<InAppDraft> = {}
): InAppDraft =>
  ready({ question: { ...blankQuestion("stars"), ...question }, ...over });

const sent = (draft: InAppDraft) =>
  draftInput(draft, { withAudience: true }).content!;

const question = (over: Partial<InAppQuestion>): InAppQuestion => ({
  ...starsQuestion,
  ...over,
});

// What the API gets back for a campaign that was read and not touched.
const roundTrip = (q: InAppQuestion) =>
  sent(
    draftFromCampaign(
      questionCampaign({ content: { title: "Hi", question: q } })
    )
  ).question;

const twoChoices = [
  { id: "option_1", text: "Search" },
  { id: "option_2", text: "Browse" },
];

describe("a question", () => {
  it("is sent as null when there is none", () => {
    expect(sent(ready()).question).toBeNull();
  });

  it("stars are read into what follows a low and a high answer", () => {
    expect(draftFromCampaign(questionCampaign()).question).toEqual({
      type: "stars",
      options: blankQuestion("stars").options,
      split: 3,
      low: "What could be better?",
      high: null,
      reviewFrom: 4,
      thanks: "Thank you",
    });
    expect(roundTrip(starsQuestion)).toEqual(starsQuestion);
  });

  it("choices go to the API and come back the same", () => {
    const asked = question({
      type: "choice",
      options: [
        { id: "search", text: "Search" },
        { id: "offline", text: "Offline mode" },
      ],
      comment: { split: null, low: "Anything to add?", high: null },
      thanks: "Thanks",
      review_from: null,
    });
    expect(roundTrip(asked)).toEqual(asked);
  });

  it("numbers the editor does not offer come back unchanged", () => {
    const asked = question({
      comment: { split: 2, low: "Why?", high: "What do you like most?" },
      review_from: 5,
    });
    expect(roundTrip(asked)).toEqual(asked);
    const alone = question({ comment: null, thanks: null, review_from: 5 });
    expect(roundTrip(alone)).toEqual(alone);
  });

  it("one question for everyone becomes the same question on both sides", () => {
    expect(
      roundTrip(question({ comment: { split: null, low: "Why?", high: null } }))
        ?.comment
    ).toEqual({ split: 3, low: "Why?", high: "Why?" });
  });

  it("a campaign without the field reads as no question", () => {
    expect(draftFromCampaign(inAppCampaign()).question).toBeNull();
  });

  it("leaves the buttons and the tap action out, and keeps them in the draft", () => {
    const draft = asking(
      {},
      {
        buttons: [{ id: "button_1", text: "Shop", action: { type: "close" } }],
        tapAction: { type: "open_url", url: "https://acme.example" },
      }
    );
    expect(sent(draft)).toMatchObject({ buttons: [], tap_action: null });
    expect(sent({ ...draft, question: null })).toMatchObject({
      buttons: [{ id: "button_1" }],
      tap_action: { type: "open_url" },
    });
  });

  it("stars: each row of the editor has its place in the payload", () => {
    const stars = (over: Partial<DraftQuestion>) => sent(asking(over)).question;
    expect(stars({})).toEqual({
      id: "q1",
      type: "stars",
      options: [],
      comment: null,
      thanks: null,
      review_from: null,
    });
    expect(stars({ low: " Why? " })).toMatchObject({
      comment: { split: 3, low: "Why?", high: null },
      review_from: null,
    });
    expect(stars({ high: "What is best?" })).toMatchObject({
      comment: { split: 3, low: null, high: "What is best?" },
      review_from: null,
    });
    expect(stars({ low: "Why?", high: "What is best?" })).toMatchObject({
      comment: { split: 3, low: "Why?", high: "What is best?" },
    });
    expect(stars({ reviewFrom: 4, thanks: " Thanks " })).toMatchObject({
      comment: null,
      review_from: 4,
      thanks: "Thanks",
    });
  });

  it("choices: no split, no question for high answers, no review", () => {
    expect(
      sent(
        asking({
          type: "choice",
          options: [
            { id: "option_1", text: " Search " },
            { id: "option_2", text: "Browse" },
          ],
          split: 2,
          low: " Why? ",
          high: "Ignored",
          thanks: "  ",
          reviewFrom: 4,
        })
      ).question
    ).toEqual({
      id: "q1",
      type: "choice",
      options: twoChoices,
      comment: { split: null, low: "Why?", high: null },
      thanks: null,
      review_from: null,
    });
    expect(
      sent(asking({ type: "choice", options: twoChoices })).question?.comment
    ).toBeNull();
  });

  it("gives each new choice an id of its own, never a removed one's", () => {
    const ids = Array.from({ length: 200 }, newOptionId);
    for (const id of ids) expect(id).toMatch(/^o_[0-9a-z]{8}$/);
    expect(new Set(ids).size).toBe(ids.length);
    // Nothing a blank question or an older campaign hands out.
    expect(ids).not.toContain("option_1");
    expect(ids).not.toContain("option_2");
  });

  it("says a range of stars in words", () => {
    expect(starsLabel(1, 3)).toBe("1 to 3 stars");
    expect(starsLabel(4, 5)).toBe("4 or 5 stars");
    expect(starsLabel(1, 2)).toBe("1 or 2 stars");
    expect(starsLabel(3, 5)).toBe("3 to 5 stars");
    expect(starsLabel(1, 1)).toBe("1 star");
    expect(starsLabel(5, 5)).toBe("5 stars");
  });
});

describe("what a question needs", () => {
  const problems = (
    over: Partial<DraftQuestion>,
    draft: Partial<InAppDraft> = {}
  ) => draftProblems(asking(over, draft)).message;

  it("finds nothing wrong with a plain one of each kind", () => {
    expect(problems({})).toEqual([]);
    expect(problems({ type: "choice", options: twoChoices })).toEqual([]);
  });

  it("still needs a title or a message, which is its wording", () => {
    expect(problems({}, { title: "" })).toEqual([
      "The message has no text yet. Add a title or a message.",
    ]);
  });

  it("does not look at buttons or a tap action it will not send", () => {
    expect(
      problems(
        {},
        {
          buttons: [{ id: "b", text: "", action: { type: "open_url" } }],
          tapAction: { type: "open_url", url: "" },
        }
      )
    ).toEqual([]);
  });

  it("may be one people cannot close: answering is the way out", () => {
    expect(problems({}, { dismissible: false })).toEqual([]);
  });

  it("names the templates that cannot hold one", () => {
    expect(IN_APP_TEMPLATES.filter((t) => questionTemplateReason(t))).toEqual([
      "alert",
      "interstitial_image",
      "half_interstitial_image",
      "cover_image",
      "html",
    ]);
    expect(problems({}, { template: "alert", dismissible: false })).toEqual([
      "Alert cannot hold a question. Choose another template.",
    ]);
    expect(
      problems(
        {},
        {
          template: "cover_image",
          image: { portrait: "https://cdn.example/a.png", landscape: null },
        }
      )
    ).toEqual(["Cover image cannot hold a question. Choose another template."]);
    expect(problems({}, { template: "footer" })).toEqual([]);
    expect(problems({}, { template: "header" })).toEqual([]);
  });

  it("a list has two to five choices, each with a text and its own id", () => {
    const option = (n: number, text = `Choice ${n}`) => ({
      id: `option_${n}`,
      text,
    });
    expect(problems({ type: "choice", options: [option(1)] })).toEqual([
      "A choice list needs 2 to 5 choices.",
    ]);
    expect(
      problems({
        type: "choice",
        options: [1, 2, 3, 4, 5, 6].map((n) => option(n)),
      })
    ).toEqual(["A choice list needs 2 to 5 choices."]);
    expect(
      problems({ type: "choice", options: [option(1), option(2, " ")] })
    ).toEqual(["Choice 2 is empty. Type its text."]);
    expect(
      problems({ type: "choice", options: [option(1), option(1, "Other")] })
    ).toEqual([
      "Two choices would be counted as one. Remove one of them and add it again.",
    ]);
  });

  it("a row that asks a question needs its text", () => {
    expect(problems({ low: " " })).toEqual([
      "Write the question for 1 to 3 stars.",
    ]);
    expect(problems({ high: "" })).toEqual([
      "Write the question for 4 or 5 stars.",
    ]);
    expect(problems({ split: 2, low: "", high: "" })).toEqual([
      "Write the question for 1 or 2 stars.",
      "Write the question for 3 to 5 stars.",
    ]);
    expect(
      problems({ type: "choice", options: twoChoices, low: "", high: "" })
    ).toEqual(["Write the follow-up question."]);
    expect(problems({ low: "Why?", high: "What is best?" })).toEqual([]);
  });
});

describe("question presets", () => {
  it("each is ready to launch and sends no buttons", () => {
    for (const preset of [rateDraft(), quickQuestionDraft()]) {
      expect(hasProblems(draftProblems(preset))).toBe(false);
      expect(sent(preset)).toMatchObject({ buttons: [], tap_action: null });
      expect(sent(preset).question?.id).toBe("q1");
    }
  });

  it("rate the app asks for stars in a banner, then for a review", () => {
    const input = draftInput(rateDraft(), { withAudience: true });
    expect(input).toMatchObject({
      name: "Rate the app",
      template: "footer",
      triggers: [{ type: "app_open" }],
      caps: { session: 1, week: 1, lifetime: null },
      content: { title: "Enjoying the app?", question: starsQuestion },
    });
  });

  it("quick question offers two choices to rename", () => {
    const input = draftInput(quickQuestionDraft(), { withAudience: true });
    expect(input.template).toBe("half_interstitial");
    expect(input.content?.question).toEqual({
      id: "q1",
      type: "choice",
      options: [
        { id: "option_1", text: "Option 1" },
        { id: "option_2", text: "Option 2" },
      ],
      comment: null,
      thanks: null,
      review_from: null,
    });
  });
});

describe("questionSentences", () => {
  it("says the question in plain words", () => {
    expect(questionSentences(rateDraft().question!).join(" ")).toBe(
      "Asks for 1 to 5 stars. People who give 1 to 3 stars are asked “What could be better?”. People who give 4 or 5 stars are asked for a store review. Says “Thank you”."
    );
    expect(questionSentences(quickQuestionDraft().question!)).toEqual([
      "Asks to pick one of: Option 1, Option 2.",
    ]);
    expect(
      questionSentences({
        ...quickQuestionDraft().question!,
        low: "Anything to add?",
        thanks: "Thanks",
      })
    ).toEqual([
      "Asks to pick one of: Option 1, Option 2.",
      "Then asks “Anything to add?”.",
      "Says “Thanks”.",
    ]);
  });

  it("uses the numbers the campaign has", () => {
    expect(
      questionSentences({
        ...blankQuestion("stars"),
        split: 2,
        high: "What is best?",
        reviewFrom: 5,
      })
    ).toEqual([
      "Asks for 1 to 5 stars.",
      "People who give 3 to 5 stars are asked “What is best?”.",
      "People who give 5 stars are asked for a store review.",
    ]);
  });
});

describe("an experiment", () => {
  it("starts with none, and is sent as nulls", () => {
    const input = draftInput(ready(), { withAudience: true });
    expect(input.control_group).toBeNull();
    expect(input.conversion).toBeNull();
    expect(input.variants).toBeNull();
  });

  it("survives a round trip through the API shape", () => {
    const campaign = experimentCampaign({
      content: {
        title: "Hello",
        message: "Welcome",
        image: { portrait: "https://cdn.example/a.png", landscape: null },
      },
    });
    const draft = draftFromCampaign(campaign);
    expect(draft.controlGroup).toBe(10);
    expect(draft.conversion).toEqual({ event: "checkout", window_hours: 72 });
    expect(draft.variants).toHaveLength(1);
    expect(draft.variants[0]!.content.title).toBe("Hi");
    const input = draftInput(draft, { withAudience: false });
    expect(input.control_group).toBe(10);
    expect(input.conversion).toEqual({ event: "checkout", window_hours: 72 });
    expect(input.variants).toEqual([
      {
        id: "b",
        content: expect.objectContaining({
          title: "Hi",
          message: "Sale on",
          // Every variant carries the pictures of A.
          image: { portrait: "https://cdn.example/a.png", landscape: null },
        }),
      },
    ]);
  });

  it("a new variant copies the one being edited, then goes its own way", () => {
    const one = addVariant(ready({ message: "Welcome" }));
    expect(nextVariantId(ready())).toBe("b");
    expect(nextVariantId(one)).toBe("c");
    expect(
      addVariant(patchVariant(one, "b", { title: "Hi" }), "b").variants[1]!
        .content.title
    ).toBe("Hi");
    expect(one.variants.map((v) => v.id)).toEqual(["b"]);
    expect(one.variants[0]!.content).toMatchObject({
      title: "Hello",
      message: "Welcome",
    });
    const edited = patchVariant(one, "b", { title: "Hi", priority: 7 });
    expect(edited.title).toBe("Hello");
    expect(edited.variants[0]!.content.title).toBe("Hi");
    expect(edited.priority).toBe(7);
    expect(variantContent(edited, "b").title).toBe("Hi");
    expect(withVariant(edited, "b")).toMatchObject({
      title: "Hi",
      message: "Welcome",
      priority: 7,
    });
    expect(withVariant(edited, "a")).toBe(edited);
  });

  it("a variant's question follows A's kind and choices, keeping its own wording", () => {
    const withQuestion = addVariant(
      ready({
        question: {
          ...blankQuestion("choice"),
          options: [
            { id: "o1", text: "Search" },
            { id: "o2", text: "Ads" },
          ],
        },
      })
    );
    const worded = patchVariant(withQuestion, "b", {
      question: {
        ...withQuestion.variants[0]!.content.question!,
        options: [
          { id: "o1", text: "Suche" },
          { id: "o2", text: "Werbung" },
        ],
      },
    });
    const grown = patchVariant(worded, "a", {
      question: {
        ...worded.question!,
        options: [...worded.question!.options, { id: "o3", text: "Friends" }],
      },
    });
    expect(grown.variants[0]!.content.question!.options).toEqual([
      { id: "o1", text: "Suche" },
      { id: "o2", text: "Werbung" },
      { id: "o3", text: "Friends" },
    ]);
    const stars = patchVariant(grown, "a", {
      question: blankQuestion("stars"),
    });
    expect(stars.variants[0]!.content.question!.type).toBe("stars");
    expect(
      patchVariant(stars, "a", { question: null }).variants[0]!.content.question
    ).toBeNull();
    expect(mirrorQuestion(null, blankQuestion("stars"))).toBeNull();
  });

  it("holds at most two variants, and re-letters after a removal", () => {
    const two = addVariant(addVariant(ready()));
    expect(two.variants.map((v) => v.id)).toEqual(["b", "c"]);
    expect(addVariant(two).variants).toHaveLength(2);
    const c = patchVariant(two, "c", { title: "Third" });
    const left = removeVariant(c, "b");
    expect(left.variants.map((v) => v.id)).toEqual(["b"]);
    expect(left.variants[0]!.content.title).toBe("Third");
  });

  it("a goal needs its event or screen, and a variant gets the checks A gets", () => {
    const problems = draftProblems({
      ...addVariant(ready()),
      conversion: { event: " ", window_hours: 24 },
    });
    expect(problems.experiment).toEqual([
      "Choose the event that counts as a conversion.",
    ]);
    expect(
      draftProblems({
        ...ready(),
        conversion: { screen: "", window_hours: 24 },
      }).experiment
    ).toEqual(["Choose the screen that counts as a conversion."]);
    const blank = draftProblems(
      patchVariant(addVariant(ready()), "b", {
        title: "",
        buttons: [{ id: "button_1", text: "", action: { type: "close" } }],
      })
    );
    expect(blank.message).toEqual([
      "Variant B: The message has no text yet. Add a title or a message.",
      "Variant B: Button 1 has no label. Type the text people will tap.",
    ]);
    expect(blank.experiment).toEqual([]);
    expect(firstProblemSection(blank)).toBe("message");
    expect(problemVariant(blank)).toBe("b");
    expect(problemVariant(draftProblems(ready()))).toBeNull();
  });

  it("says the goal in words", () => {
    expect(goalLabel({ event: "checkout", window_hours: 24 })).toBe(
      "checkout within 1 day"
    );
    expect(goalLabel({ event: "checkout", window_hours: 168 })).toBe(
      "checkout within 7 days"
    );
    expect(goalLabel({ screen: "Checkout", window_hours: 72 })).toBe(
      "the Checkout screen within 3 days"
    );
  });

  it("a screen goal goes round with its one key", () => {
    const draft = draftFromCampaign(
      inAppCampaign({ conversion: { screen: " Checkout ", window_hours: 24 } })
    );
    expect(draft.conversion).toEqual({
      screen: " Checkout ",
      window_hours: 24,
    });
    const input = draftInput(draft, { withAudience: true });
    expect(input.conversion).toEqual({ screen: "Checkout", window_hours: 24 });
    expect(input.conversion).not.toHaveProperty("event");
    expect(
      draftInput(
        { ...draft, conversion: { event: "checkout", window_hours: 72 } },
        { withAudience: true }
      ).conversion
    ).not.toHaveProperty("screen");
  });
});

describe("custom HTML", () => {
  const html = '<!doctype html><p>Hi</p><a href="https://acme.example">Go</a>';
  const htmlDraft = (over: Partial<InAppDraft> = {}): InAppDraft => ({
    ...emptyDraft(),
    template: "html",
    html,
    layout: "modal",
    ...over,
  });

  it("sends the html and its layout, and nothing a native template draws", () => {
    const input = draftInput(
      htmlDraft({
        title: "Left over",
        buttons: [{ id: "b", text: "Go", action: { type: "close" } }],
        tapAction: { type: "close" },
        layout: "banner_top",
      }),
      { withAudience: true }
    );
    expect(input.template).toBe("html");
    expect(input.content).toEqual({
      title: null,
      message: null,
      image: { portrait: null, landscape: null },
      colors: {},
      close_button: true,
      dismissible: true,
      backdrop: "none",
      buttons: [],
      tap_action: null,
      question: null,
      html,
      layout: "banner_top",
    });
    expect(
      draftInput(htmlDraft(), { withAudience: true }).content?.backdrop
    ).toBe("dim");
  });

  it("never sends html or a layout with another template", () => {
    const content = draftInput(ready({ html, layout: "full" }), {
      withAudience: true,
    }).content!;
    expect(content).not.toHaveProperty("html");
    expect(content).not.toHaveProperty("layout");
  });

  it("goes round through a campaign, variants included", () => {
    const draft = draftFromCampaign(
      inAppCampaign({
        template: "html",
        content: { html, layout: "full" },
        variants: [{ id: "b", content: { html: "<p>B</p>", layout: "modal" } }],
      })
    );
    expect(draft.html).toBe(html);
    expect(draft.layout).toBe("full");
    expect(variantContent(draft, "b")).toMatchObject({
      html: "<p>B</p>",
      layout: "modal",
    });
    const input = draftInput(draft, { withAudience: true });
    expect(input.variants![0]!.content).toMatchObject({
      html: "<p>B</p>",
      layout: "modal",
    });
  });

  it("edits a variant's own html and layout", () => {
    const draft = patchVariant(addVariant(htmlDraft()), "b", {
      html: "<p>B</p>",
      layout: "full",
    });
    expect(draft.html).toBe(html);
    expect(draft.variants[0]!.content.html).toBe("<p>B</p>");
    expect(withVariant(draft, "b").layout).toBe("full");
  });

  it("checks the html, and each variant's", () => {
    expect(contentProblems(htmlDraft(), "html", emptyDraft().image)).toEqual(
      []
    );
    expect(
      contentProblems(htmlDraft({ html: " " }), "html", emptyDraft().image)
    ).toEqual(["The HTML cannot be empty."]);
    const draft = addVariant(htmlDraft());
    const broken = patchVariant(draft, "b", {
      html: '<a href="javascript:x()">x</a>',
    });
    expect(draftProblems(broken).message).toEqual([
      "Variant B: The HTML links to an address that is not allowed.",
    ]);
  });

  it("does not ask for a title or a way out", () => {
    expect(draftProblems(htmlDraft({ dismissible: false })).message).toEqual(
      []
    );
  });

  it("warns about unsized media, per variant", () => {
    const draft = patchVariant(addVariant(htmlDraft()), "b", {
      html: '<img src="https://x.example/a.png">',
    });
    expect(draftWarnings(draft)).toEqual([
      "Variant B: The HTML has 1 unsized image or video that may make the message jump.",
    ]);
    expect(draftWarnings(ready())).toEqual([]);
  });
});
