import { describe, expect, it } from "vitest";
import { appDelegateContent } from "@/lib/IosPageConstants";
import {
  completedSteps,
  currentPart,
  defaultPlatform,
  doneCount,
  isHttpsUrl,
  isPlatform,
  isSetupComplete,
  isSetupView,
  markAddedLines,
  platformParts,
  resumeView,
  sanitizeSubdomain,
  setupHref,
  slugify,
  stripScheme,
  subdomainIdeas,
  timeAgo,
  withScheme,
  type PlatformSignals,
  type SetupSignals,
} from "../setupRules";

const none: SetupSignals = {
  domainMarked: false,
  customDomain: false,
  appConnected: false,
  appMarked: false,
  fallbackSet: false,
  hasLinks: false,
};

const platform = (over: Partial<PlatformSignals> = {}): PlatformSignals => ({
  registered: false,
  walked: new Set(),
  seen: false,
  ...over,
});

describe("resume logic", () => {
  it("starts a fresh project at the domain", () => {
    expect(resumeView(none)).toBe("domain");
    expect(isSetupComplete(none)).toBe(false);
  });

  it("moves on once the domain is chosen or a custom domain exists", () => {
    expect(resumeView({ ...none, domainMarked: true })).toBe("app");
    expect(resumeView({ ...none, customDomain: true })).toBe("app");
  });

  it("treats later progress as a settled domain", () => {
    expect(completedSteps({ ...none, fallbackSet: true }).domain).toBe(true);
    expect(resumeView({ ...none, fallbackSet: true })).toBe("app");
  });

  it("resumes at the first step whose data is missing", () => {
    expect(
      resumeView({ ...none, domainMarked: true, appConnected: true })
    ).toBe("links");
    expect(
      resumeView({
        ...none,
        domainMarked: true,
        appConnected: true,
        fallbackSet: true,
      })
    ).toBe("try");
  });

  it("keeps the app step done once app_connected is recorded", () => {
    expect(completedSteps({ ...none, appMarked: true }).app).toBe(true);
    expect(completedSteps({ ...none, appMarked: true }).domain).toBe(true);
    expect(completedSteps({ ...none, appConnected: true }).app).toBe(true);
    expect(completedSteps(none).app).toBe(false);
    expect(
      isSetupComplete({
        ...none,
        appMarked: true,
        fallbackSet: true,
        hasLinks: true,
      })
    ).toBe(true);
  });

  it("is done when every step has data", () => {
    const all = {
      ...none,
      appConnected: true,
      fallbackSet: true,
      hasLinks: true,
    };
    expect(resumeView(all)).toBe("done");
    expect(isSetupComplete(all)).toBe(true);
  });

  it("accepts only known steps and platforms from the URL", () => {
    expect(isSetupView("links")).toBe(true);
    expect(isSetupView("done")).toBe(true);
    expect(isSetupView("billing")).toBe(false);
    expect(isSetupView(null)).toBe(false);
    expect(isPlatform("android")).toBe(true);
    expect(isPlatform("tv")).toBe(false);
  });
});

describe("platform parts", () => {
  it("derives iOS parts from the saved IDs, walked guide steps and the SDK", () => {
    const parts = platformParts(
      "ios",
      platform({ registered: true, walked: new Set(["url_scheme"]) })
    );
    expect(parts.map((p) => p.key)).toEqual([
      "register_app",
      "url_scheme",
      "add_sdk",
      "initialize_sdk",
      "run",
    ]);
    expect(parts.map((p) => p.done)).toEqual([true, true, false, false, false]);
    expect(currentPart(parts)).toBe(2);
    expect(doneCount(parts)).toBe(2);
  });

  it("marks Run done only when the SDK was seen", () => {
    const walked = new Set(["url_scheme", "add_sdk", "initialize_sdk"]);
    const waiting = platformParts(
      "ios",
      platform({ registered: true, walked })
    );
    expect(currentPart(waiting)).toBe(4);
    const seen = platformParts(
      "ios",
      platform({ registered: true, walked, seen: true })
    );
    expect(currentPart(seen)).toBe(5);
  });

  it("gives Android its own guide steps and Web four parts", () => {
    expect(platformParts("android", platform()).map((p) => p.key)).toContain(
      "intent_filters"
    );
    expect(platformParts("web", platform())).toHaveLength(4);
  });

  it("opens the half-done platform, else the first unconnected app", () => {
    expect(
      defaultPlatform({
        ios: platform({ seen: true }),
        android: platform({ registered: true }),
        web: platform(),
      })
    ).toBe("android");
    expect(
      defaultPlatform({
        ios: platform({ seen: true }),
        android: platform(),
        web: platform(),
      })
    ).toBe("android");
    expect(
      defaultPlatform({ ios: platform(), android: platform(), web: platform() })
    ).toBe("ios");
  });
});

describe("markAddedLines", () => {
  it("marks the Grovs lines and the delegate block of the real AppDelegate", () => {
    const lines = markAddedLines(appDelegateContent);
    const added = (text: string) =>
      lines.find((l) => l.text.includes(text))?.added;
    expect(added("import UIKit")).toBe(false);
    expect(added("import Grovs")).toBe(true);
    expect(added("Grovs.configure")).toBe(true);
    expect(added("return true")).toBe(false);
    expect(added("extension AppDelegate: GrovsDelegate")).toBe(true);
    expect(added("debugPrint(payload)")).toBe(true);
  });

  it("drops trailing blank lines", () => {
    expect(markAddedLines("a\nb\n\n  \n")).toHaveLength(2);
  });
});

describe("helpers", () => {
  it("slugifies link names", () => {
    expect(slugify("Summer sale!")).toBe("summer-sale");
    expect(slugify("  --Été 2026-- ")).toBe("ete-2026");
    expect(slugify("x".repeat(60))).toHaveLength(40);
  });

  it("keeps subdomains to allowed characters", () => {
    expect(sanitizeSubdomain("My App.io")).toBe("myappio");
  });

  it("suggests subdomain ideas long enough to use", () => {
    const ideas = subdomainIdeas("Segments Demo", "segdemo");
    expect(ideas).toHaveLength(3);
    expect(ideas).toContain("segmentsdemo");
    expect(ideas.every((i) => i.length >= 5)).toBe(true);
    expect(subdomainIdeas("Segments Demo", "segmentsdemo")).not.toContain(
      "segmentsdemo"
    );
  });

  it("validates https URLs only", () => {
    expect(isHttpsUrl("https://segments.io")).toBe(true);
    expect(isHttpsUrl("http://segments.io")).toBe(false);
    expect(isHttpsUrl("https://")).toBe(false);
    expect(isHttpsUrl("https://not a url")).toBe(false);
  });

  it("adds and strips the scheme", () => {
    expect(withScheme("segments.io")).toBe("https://segments.io");
    expect(withScheme("http://a.io")).toBe("http://a.io");
    expect(withScheme("  ")).toBe("");
    expect(stripScheme("https://a.io/x")).toBe("a.io/x");
  });

  it("says how long ago", () => {
    const now = Date.parse("2026-10-21T12:00:00Z");
    expect(timeAgo("2026-10-21T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-10-21T11:50:00Z", now)).toBe("10 min ago");
    expect(timeAgo("2026-10-21T09:00:00Z", now)).toBe("3 h ago");
  });

  it("builds the setup link with the current environment", () => {
    window.history.replaceState(null, "", "/dashboard?env_type=Test&step=x");
    expect(setupHref(42)).toBe("/setup?env_type=Test&instance_id=42");
  });
});
