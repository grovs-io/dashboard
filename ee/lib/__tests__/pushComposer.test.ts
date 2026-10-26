import { describe, expect, it, vi } from "vitest";
import { pushContentSchema } from "@/schemas/push";
import {
  addPushVariant,
  audienceFromCampaign,
  campaignInput,
  contentFromCampaign,
  emptyContent,
  emptyExperiment,
  experimentFromCampaign,
  experimentProblems,
  experimentSummary,
  inputDiff,
  removePushVariant,
  winnerAfterLabel,
  pushErrorSection,
  parseTime,
  schedulePresets,
  scheduleSummary,
  scheduleError,
  scheduleInput,
  timezoneOptions,
  zonedWallTimeToUtc,
  type ScheduleValue,
} from "../pushComposer";
import { viewerTimeZone } from "../push";
import type { PushCampaign } from "@ee/types/push";

const campaign = (over: Partial<PushCampaign> = {}): PushCampaign =>
  ({
    id: "k9Qx2",
    name: "Spring",
    title: "Spring is here",
    body: "Open the app",
    image_url: null,
    image: null,
    sound: null,
    data: { promo: "spring26", n: 42 },
    link_id: 4821,
    source: "dashboard",
    status: "draft",
    scheduled_at: null,
    local_time: false,
    timezone: "UTC",
    audience: {
      type: "identifiers",
      recipients_count: 2,
      recipients: ["u1", "u2"],
      segment_id: null,
      segment_definition_hash: null,
    },
    ...over,
  }) as PushCampaign;

describe("zonedWallTimeToUtc", () => {
  it("reads the wall clock in the given zone, across DST", () => {
    expect(
      zonedWallTimeToUtc(
        "2026-07-01",
        "09:00",
        "Europe/Bucharest"
      )?.toISOString()
    ).toBe("2026-07-01T06:00:00.000Z");
    expect(
      zonedWallTimeToUtc(
        "2026-12-01",
        "09:00",
        "Europe/Bucharest"
      )?.toISOString()
    ).toBe("2026-12-01T07:00:00.000Z");
    expect(
      zonedWallTimeToUtc("2026-10-01", "09:00", "UTC")?.toISOString()
    ).toBe("2026-10-01T09:00:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(zonedWallTimeToUtc("2026-10", "09:00", "UTC")).toBeNull();
    expect(zonedWallTimeToUtc("2026-10-01", "", "UTC")).toBeNull();
  });
});

describe("schedule helpers", () => {
  const now = new Date("2026-09-23T12:00:00Z");
  const at = (
    date: string,
    time: string,
    localTime = false
  ): ScheduleValue => ({
    mode: "schedule",
    date,
    time,
    localTime,
    timezone: "UTC",
  });

  it("send now has no error and an empty body", () => {
    const s: ScheduleValue = { ...at("", ""), mode: "now" };
    expect(scheduleError(s, now)).toBeNull();
    expect(scheduleInput(s)).toEqual({});
  });

  it("requires a date and time, then applies the API rules", () => {
    expect(scheduleError(at("", "09:00"), now)).toBe(
      "Pick the date and time to send it."
    );
    expect(scheduleError(at("2026-09-22", "09:00", true), now)).toBe(
      "Schedule must be in the future."
    );
    expect(scheduleError(at("2026-11-30", "09:00", true), now)).toBe(
      "Schedule must be within 30 days."
    );
    expect(scheduleError(at("2026-09-23", "20:00", true), now)).toBe(
      "Local-time delivery needs at least 14 hours' notice in this timezone."
    );
    expect(
      scheduleError(
        { ...at("2026-09-23", "20:00", true), timezone: "America/Los_Angeles" },
        now
      )
    ).toBe(
      "Local-time delivery needs at least 21 hours' notice in this timezone."
    );
    expect(scheduleError(at("2026-09-25", "09:00", true), now)).toBeNull();
  });

  it("sends the instant plus the reference zone", () => {
    expect(
      scheduleInput({
        ...at("2026-10-01", "09:00", true),
        timezone: "Europe/Bucharest",
      })
    ).toEqual({
      scheduled_at: "2026-10-01T06:00:00.000Z",
      local_time: true,
      timezone: "Europe/Bucharest",
    });
    expect(scheduleInput(at("2026-10-01", "09:00")).timezone).toBe(
      viewerTimeZone()
    );
  });
});

describe("timezoneOptions", () => {
  it("lists IANA zones including the viewer's", () => {
    const zones = timezoneOptions();
    expect(zones).toContain(viewerTimeZone());
    expect(zones.length).toBeGreaterThan(1);
  });

  it("falls back to the viewer zone when Intl cannot list zones", () => {
    const original = (Intl as unknown as Record<string, unknown>)
      .supportedValuesOf;
    vi.stubGlobal("Intl", { ...Intl, supportedValuesOf: undefined });
    try {
      expect(timezoneOptions()).toEqual([viewerTimeZone()]);
    } finally {
      vi.unstubAllGlobals();
    }
    expect((Intl as unknown as Record<string, unknown>).supportedValuesOf).toBe(
      original
    );
  });
});

describe("campaign input", () => {
  it("round-trips a draft without changes, keeping typed data values", () => {
    const c = campaign();
    const input = campaignInput(
      contentFromCampaign(c),
      audienceFromCampaign(c)
    );
    expect(input).toEqual({
      name: "Spring is here",
      title: "Spring is here",
      body: "Open the app",
      image_url: null,
      sound: null,
      link_id: 4821,
      data: { promo: "spring26", n: 42 },
      audience: { type: "identifiers", recipients: ["u1", "u2"] },
      control_group: null,
      conversion: null,
      variants: null,
      test_share: null,
      winner_after_minutes: null,
      winner_by: null,
    });
  });

  it("maps each sound option to its payload value and seeds it back", () => {
    const base = { ...emptyContent(), title: "T", body: "B" };
    const aud = { type: "segment" as const, segmentId: "s1", recipients: [] };
    expect(emptyContent().soundMode).toBe("default");
    expect(campaignInput(base, aud).sound).toBe("default");
    expect(
      campaignInput({ ...base, soundMode: "silent", sound: "x" }, aud).sound
    ).toBeNull();
    expect(
      campaignInput({ ...base, soundMode: "custom", sound: " chime.caf " }, aud)
        .sound
    ).toBe("chime.caf");

    const seed = (sound: string | null) => {
      const c = contentFromCampaign(campaign({ sound }));
      return [c.soundMode, c.sound];
    };
    expect(seed("default")).toEqual(["default", ""]);
    expect(seed(null)).toEqual(["silent", ""]);
    expect(seed("")).toEqual(["silent", ""]);
    expect(seed("chime.caf")).toEqual(["custom", "chime.caf"]);
  });

  it("requires a file name for a custom sound", () => {
    const r = pushContentSchema.safeParse({
      ...emptyContent(),
      title: "T",
      body: "B",
      soundMode: "custom",
      sound: " ",
    });
    expect(r.success).toBe(false);
  });

  it("sends the title as the name", () => {
    const input = campaignInput(
      { ...emptyContent(), title: "Hi", body: "There" },
      { type: "segment", segmentId: "s1", recipients: [] }
    );
    expect(input.name).toBe("Hi");
    expect(input.audience).toEqual({ type: "segment", segment_id: "s1" });
  });

  it("never sends a name that differs from the title (an API-given name)", () => {
    const c = campaign();
    const before = campaignInput(
      contentFromCampaign(c),
      audienceFromCampaign(c),
      c
    );
    expect(before).not.toHaveProperty("name");
    const renamed = campaignInput(
      { ...contentFromCampaign(c), title: "Summer" },
      audienceFromCampaign(c),
      c
    );
    expect(inputDiff(before, renamed)).toEqual({ title: "Summer" });
  });

  it("renames on update when the name still equals the previous title", () => {
    const c = campaign({ name: "Spring is here" });
    const before = campaignInput(
      contentFromCampaign(c),
      audienceFromCampaign(c),
      c
    );
    const renamed = campaignInput(
      { ...contentFromCampaign(c), title: "Summer" },
      audienceFromCampaign(c),
      c
    );
    expect(inputDiff(before, renamed)).toEqual({
      name: "Summer",
      title: "Summer",
    });
  });

  it("diffs only the changed top-level fields", () => {
    const c = campaign();
    const before = campaignInput(
      contentFromCampaign(c),
      audienceFromCampaign(c)
    );
    const after = { ...before, title: "New" };
    expect(inputDiff(before, after)).toEqual({ title: "New" });
  });
});

describe("pushErrorSection", () => {
  it("maps each API message to the section that owns the field", () => {
    expect(pushErrorSection("Scheduled at must be in the future")).toBe(
      "delivery"
    );
    expect(pushErrorSection("local_time needs scheduled_at")).toBe("delivery");
    expect(pushErrorSection("Timezone is not a known timezone")).toBe(
      "delivery"
    );
    expect(pushErrorSection("Recipients must be non-empty strings")).toBe(
      "audience"
    );
    expect(pushErrorSection("Segment not found")).toBe("audience");
    expect(pushErrorSection("Title can't be blank")).toBe("message");
    expect(pushErrorSection("Link not found")).toBe("message");
    expect(
      pushErrorSection("push payload is 5000 bytes; APNs allows 4096")
    ).toBe("message");
    expect(pushErrorSection("Image must be a PNG, JPEG or GIF")).toBe(
      "message"
    );
    expect(pushErrorSection("Something else")).toBeNull();
  });

  it("uses the field named first", () => {
    expect(pushErrorSection("Body is too long, Recipients at most 10000")).toBe(
      "message"
    );
    expect(pushErrorSection("Recipients at most 10000, Body is too long")).toBe(
      "audience"
    );
  });
});

describe("pushContentSchema", () => {
  const valid = { ...emptyContent(), title: "T", body: "B" };

  it("accepts a minimal draft and rejects blanks and http image URLs", () => {
    expect(pushContentSchema.safeParse(valid).success).toBe(true);
    expect(pushContentSchema.safeParse({ ...valid, title: " " }).success).toBe(
      false
    );
    expect(
      pushContentSchema.safeParse({ ...valid, imageUrl: "http://x.test/a.png" })
        .success
    ).toBe(false);
    expect(
      pushContentSchema.safeParse({
        ...valid,
        imageUrl: "https://x.test/a.png",
      }).success
    ).toBe(true);
  });

  it("refuses reserved, duplicate and oversized data", () => {
    const parse = (data: { key: string; value: string }[]) =>
      pushContentSchema.safeParse({ ...valid, data });
    expect(parse([{ key: "grovs_x", value: "1" }]).success).toBe(false);
    expect(
      parse([
        { key: "a", value: "1" },
        { key: "a", value: "2" },
      ]).success
    ).toBe(false);
    expect(parse([{ key: "a", value: "x".repeat(2100) }]).success).toBe(false);
  });
});

describe("schedule presets and summary", () => {
  // Wed 2026-09-23 10:20 UTC
  const now = new Date("2026-09-23T10:20:30Z");
  const base: ScheduleValue = {
    mode: "schedule",
    date: "",
    time: "09:00",
    localTime: true,
    timezone: "Europe/Bucharest",
  };

  it("computes each preset in the chosen zone", () => {
    const presets = schedulePresets(base, now);
    expect(presets.map((p) => [p.label, p.date, p.time])).toEqual([
      ["In 1 hour", "2026-09-23", "14:21"],
      ["Tomorrow 09:00", "2026-09-24", "09:00"],
      ["Next Monday 09:00", "2026-09-28", "09:00"],
    ]);
    expect(presets[0]!.error).toMatch(/at least 11 hours'/);
    expect(presets[1]!.error).toBeNull();
    const tomorrow = {
      ...base,
      date: presets[1]!.date,
      time: presets[1]!.time,
    };
    expect(scheduleInput(tomorrow).scheduled_at).toBe(
      "2026-09-24T06:00:00.000Z"
    );
  });

  it("parses typed times", () => {
    expect(parseTime("9:07")).toBe("09:07");
    expect(parseTime("0907")).toBe("09:07");
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("abc")).toBeNull();
  });

  it("summarises the send time", () => {
    expect(scheduleSummary({ ...base, date: "2026-09-24" }, now)).toBe(
      "Sends Thu, 24 Sep at 09:00 in each user's timezone"
    );
    const fixed = { ...base, localTime: false, date: "2026-09-24" };
    expect(scheduleSummary(fixed, now)).toMatch(
      /^Sends Thu, 24 Sep at 09:00 \S+ · in \d+ hours$/
    );
    expect(scheduleSummary({ ...fixed, mode: "now" }, now)).toBeNull();
  });
});

describe("an experiment", () => {
  const withExperiment = () =>
    campaign({
      control_group: 10,
      conversion: { event: "checkout", window_hours: 72 },
      variants: [{ id: "b", title: "Hi", body: "Sale on" }],
      test_share: 20,
    });

  it("round-trips the four fields, and sends nulls without one", () => {
    const c = withExperiment();
    const e = experimentFromCampaign(c);
    expect(e).toEqual({
      controlGroup: 10,
      conversion: { event: "checkout", window_hours: 72 },
      variants: [{ id: "b", title: "Hi", body: "Sale on" }],
      testShare: 20,
      winnerAfter: null,
      winnerBy: "opens",
    });
    const input = campaignInput(
      contentFromCampaign(c),
      audienceFromCampaign(c),
      c,
      e
    );
    expect(input).toMatchObject({
      control_group: 10,
      conversion: { event: "checkout", window_hours: 72 },
      variants: [{ id: "b", title: "Hi", body: "Sale on" }],
      test_share: 20,
    });
    expect(experimentFromCampaign(campaign())).toEqual(emptyExperiment());
  });

  it("a test share goes with the variants", () => {
    const one = addPushVariant(
      { ...emptyExperiment(), testShare: 20 },
      { title: "T", body: "B" }
    );
    expect(one.variants).toEqual([{ id: "b", title: "T", body: "B" }]);
    const two = addPushVariant(one, { title: "T", body: "B" });
    expect(two.variants.map((v) => v.id)).toEqual(["b", "c"]);
    expect(addPushVariant(two, { title: "T", body: "B" })).toBe(two);
    const left = removePushVariant(
      {
        ...two,
        variants: [two.variants[0]!, { ...two.variants[1]!, title: "C" }],
      },
      "b"
    );
    expect(left.variants).toEqual([{ id: "b", title: "C", body: "B" }]);
    expect(left.testShare).toBe(20);
    expect(removePushVariant(left, "b").testShare).toBeNull();
    expect(
      campaignInput(
        emptyContent(),
        { type: "segment", segmentId: "s1", recipients: [] },
        null,
        {
          ...emptyExperiment(),
          testShare: 20,
        }
      )
    ).toMatchObject({ variants: null, test_share: null });
  });

  it("names what a goal or a variant lacks", () => {
    expect(experimentProblems(emptyExperiment())).toEqual([]);
    expect(
      experimentProblems({
        ...emptyExperiment(),
        conversion: { screen: "", window_hours: 24 },
      })
    ).toEqual(["Choose the screen that counts as a conversion."]);
    expect(
      campaignInput(
        emptyContent(),
        { type: "segment", segmentId: "s1", recipients: [] },
        null,
        {
          ...emptyExperiment(),
          conversion: { screen: " Home ", window_hours: 24 },
        }
      ).conversion
    ).toEqual({ screen: "Home", window_hours: 24 });
    expect(
      experimentProblems({
        ...emptyExperiment(),
        conversion: { event: " ", window_hours: 24 },
        variants: [
          { id: "b", title: "", body: "" },
          { id: "c", title: "x".repeat(256), body: "ok" },
        ],
      })
    ).toEqual([
      "Choose the event that counts as a conversion.",
      "Variant B: add a title.",
      "Variant B: add the message text.",
      "Variant C: the title is too long, at most 255 characters.",
    ]);
  });

  it("sums the experiment up in one line", () => {
    expect(experimentSummary(emptyExperiment())).toBeNull();
    expect(experimentSummary(experimentFromCampaign(withExperiment()))).toBe(
      "10% control group · 1 variant · 20% test share"
    );
    expect(
      experimentSummary({
        ...emptyExperiment(),
        variants: [
          { id: "b", title: "a", body: "b" },
          { id: "c", title: "a", body: "b" },
        ],
      })
    ).toBe("2 variants");
  });

  it("sends the server's experiment errors to the experiment section", () => {
    expect(pushErrorSection("Variant B title can't be blank")).toBe(
      "experiment"
    );
    expect(pushErrorSection("Control group must be at most 50")).toBe(
      "experiment"
    );
    expect(pushErrorSection("Test share needs variants")).toBe("experiment");
    expect(pushErrorSection("Conversion event is too long")).toBe("experiment");
  });
});

describe("the winner timer", () => {
  const base = () => ({
    ...emptyExperiment(),
    variants: [{ id: "b" as const, title: "Hi", body: "B" }],
    testShare: 20,
  });

  it("round-trips, and is only sent with a test share", () => {
    const c = campaign({
      variants: [{ id: "b", title: "Hi", body: "B" }],
      test_share: 20,
      winner_after_minutes: 120,
      winner_by: "conversions",
    });
    const e = experimentFromCampaign(c);
    expect(e.winnerAfter).toBe(120);
    expect(e.winnerBy).toBe("conversions");
    const aud = { type: "segment" as const, segmentId: "s1", recipients: [] };
    expect(campaignInput(emptyContent(), aud, null, e)).toMatchObject({
      winner_after_minutes: 120,
      winner_by: "conversions",
    });
    expect(
      campaignInput(emptyContent(), aud, null, { ...e, testShare: null })
    ).toMatchObject({ winner_after_minutes: null, winner_by: null });
    expect(
      campaignInput(emptyContent(), aud, null, { ...e, winnerAfter: null })
    ).toMatchObject({ winner_after_minutes: null, winner_by: null });
    expect(removePushVariant(e, "b").winnerAfter).toBeNull();
  });

  it("a test share does not go with local-time delivery", () => {
    expect(experimentProblems(base(), { localTime: true })).toEqual([
      "A test share and local-time delivery can't be used together. Turn one of them off.",
    ]);
    expect(experimentProblems(base(), { localTime: false })).toEqual([]);
    expect(
      experimentProblems({ ...base(), testShare: null }, { localTime: true })
    ).toEqual([]);
  });

  it("judging by conversions needs a goal, and the summary says the timer", () => {
    expect(
      experimentProblems({
        ...base(),
        winnerAfter: 60,
        winnerBy: "conversions",
      })
    ).toEqual([
      "To pick the winner by conversions, choose a goal in this step.",
    ]);
    expect(
      experimentProblems({
        ...base(),
        winnerAfter: 60,
        winnerBy: "conversions",
        conversion: { event: "checkout", window_hours: 24 },
      })
    ).toEqual([]);
    expect(experimentSummary({ ...base(), winnerAfter: 120 })).toBe(
      "1 variant · 20% test share · winner after 2 h by opens"
    );
    expect(winnerAfterLabel(30)).toBe("30 min");
    expect(winnerAfterLabel(1440)).toBe("1 day");
    expect(pushErrorSection("Winner after minutes is not allowed")).toBe(
      "experiment"
    );
  });
});
