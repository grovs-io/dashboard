import { describe, expect, it } from "vitest";
import type {
  PushCampaign,
  PushFailureReason,
  PushStatus,
} from "@ee/types/push";
import {
  awaitingWinner,
  untilLabel,
  devicesWord,
  reachCount,
  apnsPayloadBytes,
  buildPushFormData,
  duplicateInput,
  errorCountHint,
  errorCountLabel,
  failureReasonHint,
  formatScheduledAt,
  isPushNotEnabled,
  isPushStatus,
  pushChannels,
  soundLabel,
  soundMode,
  soundValue,
  hadUploadedImage,
  pushErrorMessage,
  statusLabel,
  statusTone,
  validateSchedule,
} from "../push";
import { dataBytes, reservedDataKey } from "@/schemas/push";
import { ApiError } from "@/lib/ApiError";

const ALL_STATUSES: PushStatus[] = [
  "draft",
  "scheduled",
  "evaluating",
  "sending",
  "sent",
  "failed",
  "cancelled",
];

const ALL_FAILURE_REASONS: PushFailureReason[] = [
  "segment_busy",
  "segment_invalid",
  "query_too_heavy",
  "evaluation_error",
];

describe("statusLabel / statusTone", () => {
  it("returns a non-empty label and a valid tone for every status", () => {
    for (const status of ALL_STATUSES) {
      expect(statusLabel(status).length).toBeGreaterThan(0);
      expect(["grey", "blue", "green", "red"]).toContain(statusTone(status));
    }
  });

  it("matches the confirmed design: draft/cancelled grey, in-flight blue, sent green, failed red", () => {
    expect(statusTone("draft")).toBe("grey");
    expect(statusTone("cancelled")).toBe("grey");
    expect(statusTone("scheduled")).toBe("blue");
    expect(statusTone("evaluating")).toBe("blue");
    expect(statusTone("sending")).toBe("blue");
    expect(statusTone("sent")).toBe("green");
    expect(statusTone("failed")).toBe("red");
  });
});

describe("failureReasonHint", () => {
  it("returns a non-empty hint for every failure reason", () => {
    for (const reason of ALL_FAILURE_REASONS) {
      expect(failureReasonHint(reason).length).toBeGreaterThan(0);
    }
  });

  it("matches the confirmed copy", () => {
    expect(failureReasonHint("segment_busy")).toMatch(/retry/i);
    expect(failureReasonHint("segment_invalid")).toMatch(/segment/i);
    expect(failureReasonHint("query_too_heavy")).toMatch(/narrow/i);
    expect(failureReasonHint("evaluation_error")).toMatch(/support/i);
  });
});

describe("errorCountLabel", () => {
  it("labels known APNs reasons with a sentence", () => {
    expect(errorCountLabel("Unregistered")).toBe(
      "Device uninstalled or token expired"
    );
    expect(errorCountLabel("BadDeviceToken")).toContain("token");
    expect(errorCountLabel("PayloadTooLarge")).toContain("payload");
  });

  it("humanizes an unknown CamelCase APNs reason", () => {
    expect(errorCountLabel("SomeNewReason")).toBe("Some New Reason");
  });

  it("labels numeric FCM status codes as 'FCM <code>: …'", () => {
    expect(errorCountLabel("404")).toBe("FCM 404: Device not registered");
    expect(errorCountLabel("999")).toBe("FCM 999: Delivery failed");
  });
});

describe("pushErrorMessage", () => {
  it("maps every documented error code to a message", () => {
    const codes = [
      "rate_limited",
      "enterprise_required",
      "segment_busy",
      "invalid_segment",
      "query_too_heavy",
      "clickhouse_unavailable",
    ];
    for (const code of codes) {
      expect(pushErrorMessage(code, "fallback")).not.toBe("fallback");
    }
  });

  it("falls back for an unknown or missing code", () => {
    expect(pushErrorMessage("something_else", "fallback message")).toBe(
      "fallback message"
    );
    expect(pushErrorMessage(undefined, "fallback message")).toBe(
      "fallback message"
    );
  });
});

describe("validateSchedule", () => {
  const now = new Date("2026-09-23T00:00:00Z");

  it("allows send-now (no scheduled_at, no local_time)", () => {
    expect(validateSchedule({ scheduledAt: undefined }, now)).toBeNull();
  });

  it("requires scheduled_at when local_time is on", () => {
    expect(
      validateSchedule({ scheduledAt: undefined, localTime: true }, now)
    ).toMatch(/scheduled time/);
  });

  it("rejects a schedule not in the future", () => {
    expect(validateSchedule({ scheduledAt: now.toISOString() }, now)).toMatch(
      /future/
    );
    expect(
      validateSchedule({ scheduledAt: "2026-09-22T23:59:59Z" }, now)
    ).toMatch(/future/);
  });

  it("accepts a schedule just inside the future boundary", () => {
    expect(
      validateSchedule({ scheduledAt: "2026-09-23T00:00:01Z" }, now)
    ).toBeNull();
  });

  it("rejects a schedule beyond 30 days and accepts exactly 30 days", () => {
    const at30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const over30Days = new Date(at30Days.getTime() + 1000);
    expect(
      validateSchedule({ scheduledAt: at30Days.toISOString() }, now)
    ).toBeNull();
    expect(
      validateSchedule({ scheduledAt: over30Days.toISOString() }, now)
    ).toMatch(/30 days/);
  });

  it("requires 14 hours minus the zone's UTC offset for local-time delivery, boundary included", () => {
    const H = 60 * 60 * 1000;
    const check = (timezone: string | undefined, hours: number) => {
      const under = new Date(now.getTime() + hours * H - 1000).toISOString();
      const at = new Date(now.getTime() + hours * H).toISOString();
      expect(
        validateSchedule({ scheduledAt: under, localTime: true, timezone }, now)
      ).toBe(
        `Local-time delivery needs at least ${hours} hours' notice in this timezone.`
      );
      expect(
        validateSchedule({ scheduledAt: at, localTime: true, timezone }, now)
      ).toBeNull();
    };
    check(undefined, 14);
    check("UTC", 14);
    check("America/Los_Angeles", 21);
    check("Asia/Tokyo", 5);
    expect(
      validateSchedule(
        {
          scheduledAt: new Date(now.getTime() + 1000).toISOString(),
          localTime: true,
          timezone: "Pacific/Kiritimati",
        },
        now
      )
    ).toBeNull();
  });

  it("rounds the local-time lead up and reads the offset at the scheduled instant", () => {
    const H = 60 * 60 * 1000;
    expect(
      validateSchedule(
        {
          scheduledAt: new Date(now.getTime() + 8 * H).toISOString(),
          localTime: true,
          timezone: "Asia/Kolkata",
        },
        now
      )
    ).toMatch(/at least 9 hours'/);
    // New York leaves DST at 06:00Z on 1 Nov, so the lead is 19h, not 18h.
    const beforeDstEnd = new Date("2026-10-31T12:00:00Z");
    expect(
      validateSchedule(
        {
          scheduledAt: "2026-11-01T06:30:00Z",
          localTime: true,
          timezone: "America/New_York",
        },
        beforeDstEnd
      )
    ).toMatch(/at least 19 hours'/);
  });

  it("does not enforce the local-time lead when local_time is off", () => {
    const soon = new Date(now.getTime() + 60 * 60 * 1000);
    expect(
      validateSchedule({ scheduledAt: soon.toISOString() }, now)
    ).toBeNull();
  });

  it("rejects an unparseable date", () => {
    expect(validateSchedule({ scheduledAt: "not-a-date" }, now)).toMatch(
      /valid date/
    );
  });
});

describe("apnsPayloadBytes", () => {
  it("mirrors Payload#apns for a minimal campaign (alert + grovs_campaign_id only)", () => {
    const bytes = apnsPayloadBytes({ title: "Hi", body: "Body" });
    expect(bytes).toBe(75);
  });

  it("mirrors Payload#apns for a full fixture (sound, image, data, link)", () => {
    const bytes = apnsPayloadBytes({
      title: "Hi",
      body: "Body",
      sound: "default",
      data: { promo: "spring26" },
      link: "https://sqd.link/abc",
      image: "https://cdn.example.com/i.png",
    });
    expect(bytes).toBe(214);
  });

  it("strips reserved keys from custom data before sizing, as the backend overwrites them", () => {
    const withReserved = apnsPayloadBytes({
      title: "Hi",
      body: "Body",
      data: { grovs_link: "https://evil.example.com", promo: "spring26" },
      link: "https://sqd.link/abc",
    });
    const withoutReserved = apnsPayloadBytes({
      title: "Hi",
      body: "Body",
      data: { promo: "spring26" },
      link: "https://sqd.link/abc",
    });
    expect(withReserved).toBe(withoutReserved);
  });

  it("grows with a longer body, staying comparable to the 4096-byte APNs limit", () => {
    const short = apnsPayloadBytes({ title: "Hi", body: "Body" });
    const long = apnsPayloadBytes({ title: "Hi", body: "B".repeat(4100) });
    expect(long).toBeGreaterThan(short);
    expect(long).toBeGreaterThan(4096);
  });
});

describe("dataBytes", () => {
  it("measures the serialised byte size", () => {
    expect(dataBytes({ a: "b" })).toBe(JSON.stringify({ a: "b" }).length);
    expect(dataBytes(undefined)).toBe(2); // "{}"
  });
});

describe("reservedDataKey", () => {
  it("refuses any key starting with grovs_", () => {
    expect(reservedDataKey("grovs_campaign_id")).toBe(true);
    expect(reservedDataKey("grovs_anything")).toBe(true);
    expect(reservedDataKey("promo")).toBe(false);
    expect(reservedDataKey("Grovs_case")).toBe(false);
  });
});

describe("buildPushFormData", () => {
  it("appends scalar content fields", () => {
    const form = buildPushFormData({
      name: "Spring",
      title: "Spring is here",
      body: "Open the app",
      sound: "default",
      link_id: 4821,
    });
    expect(form.get("name")).toBe("Spring");
    expect(form.get("title")).toBe("Spring is here");
    expect(form.get("body")).toBe("Open the app");
    expect(form.get("sound")).toBe("default");
    expect(form.get("link_id")).toBe("4821");
  });

  it("omits undefined fields and clears null fields to an empty string", () => {
    const form = buildPushFormData({ image_url: null });
    expect(form.has("name")).toBe(false);
    expect(form.get("image_url")).toBe("");
  });

  it("sends custom data as data[<key>] pairs, not a JSON string, matching params[:data].to_unsafe_h", () => {
    const form = buildPushFormData({ data: { promo: "spring26", n: 1 } });
    expect(form.get("data[promo]")).toBe("spring26");
    expect(form.get("data[n]")).toBe("1");
    expect(form.get("data")).toBeNull();
  });

  it("sends audience type, segment_id and recipients as bracketed fields", () => {
    const form = buildPushFormData({
      audience: {
        type: "identifiers",
        recipients: ["user_1", "user_2"],
      },
    });
    expect(form.get("audience[type]")).toBe("identifiers");
    expect(form.getAll("audience[recipients][]")).toEqual(["user_1", "user_2"]);
  });

  it("carries the experiment: scalars as fields, objects as JSON, null clears", () => {
    const form = buildPushFormData({
      control_group: 10,
      conversion: { event: "checkout", window_hours: 72 },
      variants: [{ id: "b", title: "Hi", body: "B" }],
      test_share: 20,
      winner_after_minutes: 120,
      winner_by: "opens",
    });
    expect(form.get("control_group")).toBe("10");
    expect(form.get("test_share")).toBe("20");
    expect(form.get("winner_after_minutes")).toBe("120");
    expect(form.get("winner_by")).toBe("opens");
    expect(JSON.parse(form.get("conversion") as string)).toEqual({
      event: "checkout",
      window_hours: 72,
    });
    expect(JSON.parse(form.get("variants") as string)).toEqual([
      { id: "b", title: "Hi", body: "B" },
    ]);
    const cleared = buildPushFormData({ conversion: null, variants: null });
    expect(cleared.get("conversion")).toBe("");
    expect(cleared.get("variants")).toBe("");
    expect(buildPushFormData({}).has("conversion")).toBe(false);
  });

  it("appends the image file under the image key", () => {
    const file = new File(["x"], "pic.png", { type: "image/png" });
    const form = buildPushFormData({}, file);
    expect(form.get("image")).toBe(file);
  });
});

const campaign = (over: Partial<PushCampaign> = {}): PushCampaign => ({
  id: "c1",
  name: "Spring sale",
  title: "Spring is here",
  body: "Open the app",
  image_url: null,
  image: null,
  sound: null,
  data: { promo: "spring26" },
  link_id: 4821,
  source: "dashboard",
  status: "sent",
  scheduled_at: null,
  local_time: false,
  timezone: "UTC",
  evaluated_at: null,
  started_at: null,
  finished_at: "2026-09-22T00:00:00Z",
  failure_reason: null,
  audience: {
    type: "identifiers",
    recipients_count: 2,
    recipients: ["user_1", "user_2"],
    segment_id: null,
    segment_definition_hash: null,
  },
  report: {
    targeted: 2,
    no_channel: 0,
    not_found: 0,
    queued: 0,
    delivered: 2,
    failed: 0,
    opened: 0,
    cancelled: 0,
    held: 0,
    waiting: 0,
    error_counts: {},
    audience: { persons: null, devices: null, incomplete: false },
  },
  created_at: "2026-09-20T00:00:00Z",
  control_group: null,
  conversion: null,
  variants: null,
  test_share: null,
  winner_after_minutes: null,
  winner_by: null,
  winner_due_at: null,
  winner: null,
  updated_at: "2026-09-22T00:00:00Z",
  ...over,
});

describe("hadUploadedImage", () => {
  it("is false when there is no image at all", () => {
    expect(hadUploadedImage(campaign({ image_url: null, image: null }))).toBe(
      false
    );
  });

  it("is false when the image came from a URL", () => {
    expect(
      hadUploadedImage(
        campaign({
          image_url: "https://cdn.example.com/i.png",
          image: "https://cdn.example.com/i.png",
        })
      )
    ).toBe(false);
  });

  it("is true when the image was uploaded (no image_url, but image is set)", () => {
    expect(
      hadUploadedImage(
        campaign({ image_url: null, image: "https://s3.example.com/up.png" })
      )
    ).toBe(true);
  });
});

describe("duplicateInput", () => {
  it("copies content, link and data, and an image set via URL", () => {
    const input = duplicateInput(
      campaign({ image_url: "https://cdn.example.com/i.png", sound: "default" })
    );
    expect(input).toMatchObject({
      name: "Spring sale",
      title: "Spring is here",
      body: "Open the app",
      image_url: "https://cdn.example.com/i.png",
      sound: "default",
      data: { promo: "spring26" },
      link_id: 4821,
    });
  });

  it("copies the experiment as set up, never its outcome", () => {
    const input = duplicateInput(
      campaign({
        control_group: 10,
        conversion: { event: "checkout", window_hours: 72 },
        variants: [{ id: "b", title: "Hi", body: "B" }],
        test_share: 20,
        winner_after_minutes: 120,
        winner_by: "opens",
        winner_due_at: "2026-09-23T12:00:00Z",
        winner: "b",
      })
    );
    expect(input).toMatchObject({
      control_group: 10,
      conversion: { event: "checkout", window_hours: 72 },
      variants: [{ id: "b", title: "Hi", body: "B" }],
      test_share: 20,
      winner_after_minutes: 120,
      winner_by: "opens",
    });
    expect(input).not.toHaveProperty("winner");
    expect(input).not.toHaveProperty("winner_due_at");
  });

  it("keeps a Silent campaign silent: sound null is sent, not dropped", () => {
    const input = duplicateInput(campaign({ sound: null }));
    expect(input).toHaveProperty("sound", null);
  });

  it("does not copy an uploaded image", () => {
    const input = duplicateInput(
      campaign({ image_url: null, image: "https://s3.example.com/up.png" })
    );
    expect(input.image_url).toBeUndefined();
  });

  it("copies an identifiers/visitors audience's type and recipients", () => {
    const input = duplicateInput(
      campaign({
        audience: {
          type: "visitors",
          recipients_count: 2,
          recipients: ["uuid-1", "uuid-2"],
          segment_id: null,
          segment_definition_hash: null,
        },
      })
    );
    expect(input.audience).toEqual({
      type: "visitors",
      recipients: ["uuid-1", "uuid-2"],
    });
  });

  it("copies a segment audience's segment_id, not recipients", () => {
    const input = duplicateInput(
      campaign({
        audience: {
          type: "segment",
          recipients_count: 100,
          segment_id: "seg_1",
          segment_definition_hash: "h",
        },
      })
    );
    expect(input.audience).toEqual({ type: "segment", segment_id: "seg_1" });
  });
});

describe("formatScheduledAt", () => {
  const at = (scheduled_at: string, timezone: string, local_time = false) => ({
    scheduled_at,
    timezone,
    local_time,
  });

  it("formats date and time in the campaign's zone across a DST change", () => {
    expect(
      formatScheduledAt(at("2026-03-07T14:00:00Z", "America/New_York"))
    ).toBe("Sat, 7 Mar 2026 at 09:00 EST");
    expect(
      formatScheduledAt(at("2026-03-09T13:00:00Z", "America/New_York"))
    ).toBe("Mon, 9 Mar 2026 at 09:00 EDT");
  });

  it("keeps the date and the time in the same zone near midnight", () => {
    expect(
      formatScheduledAt(at("2026-03-08T03:30:00Z", "America/New_York"))
    ).toBe("Sat, 7 Mar 2026 at 22:30 EST");
    expect(formatScheduledAt(at("2026-03-08T03:30:00Z", "Asia/Tokyo"))).toMatch(
      /^Sun, 8 Mar 2026 at 12:30 /
    );
  });

  it("shows the wall clock in the campaign's zone for local-time delivery", () => {
    expect(
      formatScheduledAt(at("2026-03-09T13:00:00Z", "America/New_York", true))
    ).toBe("Mon, 9 Mar 2026 at 09:00 in each user's local time");
  });

  it("falls back to the viewer's zone when the campaign has none", () => {
    expect(
      formatScheduledAt(at("2026-06-01T08:00:00Z", ""), "long", "UTC")
    ).toBe("Mon, 1 Jun 2026 at 08:00 UTC");
    expect(
      formatScheduledAt(at("2026-06-01T08:00:00Z", "Not/AZone"), "long", "UTC")
    ).toBe("Mon, 1 Jun 2026 at 08:00 UTC");
  });

  it("has a short form and nothing for an unscheduled campaign", () => {
    expect(formatScheduledAt(at("2026-06-01T08:00:00Z", "UTC"), "short")).toBe(
      "Jun 1, 2026 08:00 UTC"
    );
    expect(
      formatScheduledAt({
        scheduled_at: null,
        timezone: "UTC",
        local_time: false,
      })
    ).toBeNull();
  });
});

describe("isPushStatus", () => {
  it("accepts every status and rejects anything else", () => {
    for (const status of ALL_STATUSES) expect(isPushStatus(status)).toBe(true);
    expect(isPushStatus("bogus")).toBe(false);
    expect(isPushStatus("all")).toBe(false);
  });
});

describe("isPushNotEnabled", () => {
  it("is true only for a 404 that says not enabled", () => {
    expect(
      isPushNotEnabled(new ApiError("Push campaigns are not enabled", 404))
    ).toBe(true);
    expect(
      isPushNotEnabled(
        new ApiError("Not Found", 404, undefined, {
          error: "Push is not enabled",
        })
      )
    ).toBe(true);
    expect(isPushNotEnabled(new ApiError("Not found", 404))).toBe(false);
    expect(isPushNotEnabled(new ApiError("not enabled", 403))).toBe(false);
    expect(isPushNotEnabled(new Error("not enabled"))).toBe(false);
  });
});

describe("sound mapping", () => {
  it("maps each mode to its payload value and back", () => {
    expect(soundValue("default", "")).toBe("default");
    expect(soundValue("silent", "chime.caf")).toBeNull();
    expect(soundValue("custom", " chime.caf ")).toBe("chime.caf");
    expect(soundValue("custom", " ")).toBeNull();
    expect(soundMode("default")).toBe("default");
    expect(soundMode(null)).toBe("silent");
    expect(soundMode("chime.caf")).toBe("custom");
    expect(soundLabel("default")).toBe("Default");
    expect(soundLabel(null)).toBe("Silent");
  });
});

describe("pushChannels", () => {
  const ios = (configuration: Record<string, unknown> | undefined) => ({
    platform: "ios",
    configuration,
  });
  const android = (configuration: Record<string, unknown> | undefined) => ({
    platform: "android",
    configuration,
  });
  const IOS_OK = {
    bundle_id: "com.acme",
    app_prefix: "TEAM1",
    push_configuration: { configured: true },
  };
  const ANDROID_OK = { push_configuration: { firebase_project_id: "acme-fb" } };

  it.each([
    [
      "both set up",
      [ios(IOS_OK), android(ANDROID_OK)],
      { ios: true, android: true },
    ],
    ["nothing at all", [], { ios: false, android: false }],
    ["iOS only", [ios(IOS_OK)], { ios: true, android: false }],
    ["Android only", [android(ANDROID_OK)], { ios: false, android: true }],
    [
      "iOS push not configured",
      [ios({ ...IOS_OK, push_configuration: { configured: false } })],
      { ios: false, android: false },
    ],
    [
      "iOS without app_prefix",
      [ios({ ...IOS_OK, app_prefix: undefined })],
      { ios: false, android: false },
    ],
    [
      "iOS without bundle_id",
      [ios({ ...IOS_OK, bundle_id: "" })],
      { ios: false, android: false },
    ],
    [
      "iOS null push_configuration",
      [ios({ ...IOS_OK, push_configuration: null })],
      { ios: false, android: false },
    ],
    [
      "iOS app with no configuration",
      [ios(undefined)],
      { ios: false, android: false },
    ],
    [
      "Android null push_configuration",
      [android({ push_configuration: null })],
      { ios: false, android: false },
    ],
    [
      "Android without firebase_project_id",
      [android({ push_configuration: {} })],
      { ios: false, android: false },
    ],
  ])("%s", (_name, configs, expected) => {
    expect(pushChannels(configs as never)).toEqual(expected);
  });
});

describe("delivery error labels", () => {
  it("labels no_app and no_token, and hints at setup for no_app", () => {
    expect(errorCountLabel("no_app")).toBe(
      "Push not configured for this platform"
    );
    expect(errorCountLabel("no_token")).toBe("Device has no push token");
    expect(errorCountHint("no_app")).toMatch(/iOS setup or Android setup/);
    expect(errorCountHint("Unregistered")).toBeNull();
  });
});

describe("reachCount / devicesWord", () => {
  const base = { devices: 9, no_channel: 0, not_found: 0 };
  it("uses reachable, else all matched devices when there is no platform split", () => {
    expect(reachCount({ ...base, reachable: 4 })).toBe(4);
    expect(reachCount({ ...base, reachable: 0 })).toBe(0);
    expect(reachCount({ ...base, reachable: null })).toBe(9);
    expect(reachCount(base)).toBe(9);
  });
  it("pluralises everything but one", () => {
    expect(devicesWord(1)).toBe("device");
    expect(devicesWord(0)).toBe("devices");
    expect(devicesWord(undefined)).toBe("devices");
  });
});

describe("untilLabel", () => {
  const now = new Date("2026-09-20T10:00:00Z");
  it("says how long until an instant, in three shapes", () => {
    expect(untilLabel("2026-09-20T12:57:43Z", now)).toBe("2 h 57 min 43 s");
    expect(untilLabel("2026-09-20T12:00:00Z", now)).toBe("2 h 0 min 0 s");
    expect(untilLabel("2026-09-20T10:12:05Z", now)).toBe("12 min 05 s");
    expect(untilLabel("2026-09-20T10:00:42Z", now)).toBe("42 s");
    expect(untilLabel("2026-09-20T09:59:00Z", now)).toBe("any minute now");
    expect(untilLabel("nope", now)).toBe("any minute now");
  });
});

describe("awaitingWinner", () => {
  it("holds while sent with people waiting and no winner yet", () => {
    const c = campaign({ status: "sent" });
    expect(awaitingWinner({ ...c, report: { ...c.report, waiting: 5 } })).toBe(
      true
    );
    expect(awaitingWinner(c)).toBe(false);
    expect(
      awaitingWinner({ ...c, report: { ...c.report, waiting: 5 }, winner: "b" })
    ).toBe(false);
    expect(
      awaitingWinner({
        ...c,
        status: "sending",
        report: { ...c.report, waiting: 5 },
      })
    ).toBe(false);
  });
});
