import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/ApiError";
import {
  TEMPLATES,
  canEdit,
  canEnd,
  canPause,
  canResume,
  clickRate,
  failureText,
  inAppErrorText,
  inAppStatusLabel,
  isInAppNotEnabled,
  isInAppStatus,
  launchSentence,
  triggerLabel,
} from "../inApp";
import {
  IN_APP_STATUSES,
  IN_APP_TEMPLATES,
  type InAppTrigger,
} from "@ee/types/inApp";
import { inAppCampaign } from "./inAppFixtures";

describe("statuses", () => {
  it("every status has a label", () => {
    for (const status of IN_APP_STATUSES)
      expect(inAppStatusLabel(status)).toBeTruthy();
    expect(isInAppStatus("live")).toBe(true);
    expect(isInAppStatus("sent")).toBe(false);
  });

  it("each step is offered only where the server accepts it", () => {
    const allowed = IN_APP_STATUSES.map((status) => {
      const c = inAppCampaign({ status });
      return [status, canPause(c), canResume(c), canEnd(c), canEdit(c)];
    });
    expect(allowed).toEqual([
      ["draft", false, false, false, true],
      ["preparing", false, false, true, true],
      ["scheduled", false, false, true, true],
      ["live", true, false, true, true],
      ["paused", false, true, true, true],
      ["ended", false, false, false, false],
    ]);
  });
});

describe("templates", () => {
  it("every template is described", () => {
    for (const template of IN_APP_TEMPLATES)
      expect(TEMPLATES[template].label).toBeTruthy();
  });

  it("knows which take text, an image, and sit at an edge", () => {
    expect(TEMPLATES.cover_image.imageOnly).toBe(true);
    expect(TEMPLATES.alert.image).toBe(false);
    expect(TEMPLATES.header.banner).toBe(true);
    expect(TEMPLATES.interstitial).toMatchObject({
      imageOnly: false,
      image: true,
      banner: false,
      html: false,
    });
    expect(TEMPLATES.html).toMatchObject({
      label: "Custom HTML",
      imageOnly: false,
      image: false,
      html: true,
    });
  });
});

describe("triggerLabel", () => {
  const cases: [InAppTrigger, string][] = [
    [{ type: "app_open" }, "The app is opened"],
    [{ type: "screen_view" }, "Any screen is viewed"],
    [{ type: "screen_view", name: "Cart" }, 'Screen "Cart" is viewed'],
    [{ type: "event", name: "paid" }, 'Event "paid" happens'],
    [
      { type: "event", name: "paid", filters: [{ field: "a", op: "is_set" }] },
      'Event "paid" happens (1 filter)',
    ],
  ];
  it.each(cases)("%o", (trigger, label) => {
    expect(triggerLabel(trigger)).toBe(label);
  });
});

describe("launchSentence", () => {
  it("names custom HTML as a message", () => {
    expect(
      launchSentence("html", [{ type: "app_open" }], "everyone", false)
    ).toBe(
      "A custom HTML message shown to everyone when the app is opened, as soon as it is launched."
    );
  });

  it("says in one sentence what launching does", () => {
    expect(
      launchSentence("interstitial", [{ type: "app_open" }], "everyone", false)
    ).toBe(
      "An interstitial shown to everyone when the app is opened, as soon as it is launched."
    );
    expect(
      launchSentence(
        "header",
        [{ type: "event", name: "paid" }, { type: "screen_view" }],
        "people in VIPs",
        true
      )
    ).toBe(
      'A header shown to people in VIPs when event "paid" happens, or any screen is viewed, from its start date.'
    );
  });
});

describe("errors", () => {
  it("prefers the sentence the server sent", () => {
    const error = new ApiError(
      "The provided data is invalid.",
      422,
      undefined,
      {
        error:
          "The property '#/triggers' did not contain a minimum number of items 1",
      }
    );
    expect(inAppErrorText(error, "fallback")).toMatch(/triggers/);
    expect(inAppErrorText(new ApiError("Plain", 500), "fallback")).toBe(
      "Plain"
    );
    expect(inAppErrorText(new Error("x"), "fallback")).toBe("fallback");
  });

  it("tells the feature being off from a campaign that is missing", () => {
    const off = new ApiError("Not found", 404, undefined, {
      error: "In-app messages are not enabled",
    });
    const missing = new ApiError("Not found", 404, undefined, {
      error: "In-app campaign not found",
    });
    expect(isInAppNotEnabled(off)).toBe(true);
    expect(isInAppNotEnabled(missing)).toBe(false);
    expect(isInAppNotEnabled(new Error("x"))).toBe(false);
  });

  it("explains why a launch came back", () => {
    expect(failureText(null)).toBeNull();
    expect(failureText("segment_invalid")).toMatch(/segment/);
    expect(failureText("something_new")).toBe("The launch did not complete.");
  });

  it("shows the click rate as a percentage", () => {
    expect(clickRate(0.5)).toBe("50.0%");
    expect(clickRate(0)).toBe("0.0%");
  });
});
