import { describe, expect, it } from "vitest";
import { GALLERY, SAMPLE_VIDEO_URL } from "../inAppHtmlGallery";
import {
  htmlBytes,
  htmlLayout,
  htmlProblems,
  htmlWarnings,
} from "../inAppHtml";
import { fieldsOf } from "../inAppQuickEdit";

const parse = (html: string) =>
  new DOMParser().parseFromString(html, "text/html");

// The names the SDKs refuse for grovs.track (ee/config/in_app/reserved_events.json).
const RESERVED = [
  "app_open",
  "custom",
  "in_app_answered",
  "in_app_clicked",
  "in_app_commented",
  "in_app_dismissed",
  "in_app_held",
  "in_app_viewed",
  "install",
  "journey_entered",
  "journey_held",
  "journey_path",
  "open",
  "push_delivered",
  "push_held",
  "push_open",
  "reactivation",
  "reinstall",
  "screen_view",
  "time_spent",
  "user_referred",
  "view",
];

const FIELDS: Record<string, string[]> = {
  "promo-video": [
    "color:Brand colour",
    "video:Video: replace with your own",
    "text:Label",
    "text:Headline",
    "text:Text",
    "button:Main button",
    "button:Dismiss button",
  ],
  "product-launch": [
    "color:Brand colour",
    "image:Hero image",
    "text:Label",
    "text:Headline",
    "text:Text",
    "text:Point 1",
    "text:Point 2",
    "text:Point 3",
    "button:Main button",
    "button:Dismiss button",
  ],
  "push-primer": [
    "color:Brand colour",
    "text:Headline",
    "text:Text",
    "text:Text when already on",
    "text:Text when turned off",
    "text:Point 1",
    "text:Point 2",
    "text:Allow button",
    "button:Dismiss button",
  ],
  "countdown-offer": [
    "color:Brand colour",
    "text:Label",
    "text:Headline",
    "text:Text",
    "button:Main button",
    "button:Dismiss button",
  ],
  "feature-tour": [
    "color:Brand colour",
    "text:Slide 1 title",
    "text:Slide 1 text",
    "text:Slide 2 title",
    "text:Slide 2 text",
    "text:Slide 3 title",
    "text:Slide 3 text",
    "button:Skip button",
    "text:Next button",
    "button:Finish button",
  ],
  feedback: [
    "color:Brand colour",
    "text:Question",
    "button:Awful",
    "button:Bad",
    "button:Okay",
    "button:Good",
    "button:Great",
    "text:Thanks",
  ],
  "announcement-banner": [
    "color:Brand colour",
    "text:Label",
    "text:Headline",
    "text:Text",
    "button:Link button",
  ],
  "win-back": [
    "color:Brand colour",
    "text:Headline",
    "text:Text",
    "text:Code",
    "text:Copy button",
    "button:Main button",
    "button:Dismiss button",
  ],
  blank: ["color:Brand colour", "text:Headline", "text:Text", "button:Button"],
};

describe("the gallery", () => {
  it("holds the eight examples and Blank, last", () => {
    expect(GALLERY.map((e) => e.id)).toEqual([
      "promo-video",
      "product-launch",
      "push-primer",
      "countdown-offer",
      "feature-tour",
      "feedback",
      "announcement-banner",
      "win-back",
      "blank",
    ]);
    for (const example of GALLERY) {
      expect(example.title).not.toBe("");
      expect(example.description).not.toBe("");
    }
  });

  describe.each(GALLERY.map((e) => [e.id, e] as const))("%s", (_id, e) => {
    const doc = parse(e.html);

    it("passes the dashboard's checks with no problems and no warnings", () => {
      expect(htmlProblems(e.html)).toEqual([]);
      expect(htmlWarnings(e.html)).toEqual([]);
      expect(htmlBytes(e.html)).toBeLessThan(32 * 1024);
    });

    it("starts in standards mode with a viewport for phones", () => {
      expect(e.html.startsWith("<!doctype html>")).toBe(true);
      expect(doc.compatMode).toBe("CSS1Compat");
      expect(
        doc
          .querySelector('meta[name="viewport"]')
          ?.getAttribute("content")
          ?.replace(/\s/g, "")
      ).toBe("width=device-width,initial-scale=1,viewport-fit=cover");
    });

    it("draws edge to edge and keeps its content inside the safe area", () => {
      for (const side of ["left", "right"])
        expect(e.html).toContain(`env(safe-area-inset-${side})`);
    });

    it("names its top colour for the status bar, per scheme when it follows dark mode", () => {
      const metas = [...doc.querySelectorAll('meta[name="theme-color"]')];
      expect(metas.length === 1 || metas.length === 2).toBe(true);
      for (const meta of metas)
        expect(meta.getAttribute("content")).toMatch(/^#[0-9A-F]{6}$/);
      if (metas.length === 2)
        expect(metas.map((m) => m.getAttribute("media"))).toEqual([
          "(prefers-color-scheme: light)",
          "(prefers-color-scheme: dark)",
        ]);
    });

    it("names the layout it is made for, except Blank", () => {
      expect(htmlLayout(e.html)).toBe(e.id === "blank" ? null : e.layout);
    });

    it("uses declarative actions and no inline handlers", () => {
      for (const el of doc.querySelectorAll("[data-grovs-action]")) {
        const action = el.getAttribute("data-grovs-action");
        expect(["close", "open", "track"]).toContain(action);
        if (action === "open")
          expect(el.getAttribute("data-grovs-url")).toMatch(/^https:\/\//);
        if (action === "track") {
          const name = el.getAttribute("data-grovs-event")!;
          expect(name).toMatch(/^[a-z][a-z0-9_]{0,99}$/);
          expect(RESERVED).not.toContain(name);
        }
      }
      for (const el of doc.querySelectorAll("*"))
        for (const attr of el.attributes)
          expect(attr.name.startsWith("on")).toBe(false);
    });

    it("never draws its own close X", () => {
      for (const el of doc.querySelectorAll("button, a, [role=button]")) {
        expect(el.getAttribute("aria-label") ?? "").not.toMatch(/^close$/i);
        expect((el.textContent ?? "").trim()).not.toMatch(/^[×✕✖xX]$/);
      }
    });

    it("loads only https or inline images", () => {
      const html = e.html.replaceAll("http://www.w3.org/2000/svg", "");
      expect(html).not.toMatch(/http:\/\//);
      for (const el of doc.querySelectorAll("[src], [poster]")) {
        const url = el.getAttribute("src") ?? el.getAttribute("poster")!;
        const image = el.localName === "img" || el.hasAttribute("poster");
        expect(url).toMatch(image ? /^(https:\/\/|data:image\/)/ : /^https:/);
      }
    });

    it("follows light and dark mode and has a brand colour to edit", () => {
      expect(e.html).toMatch(/@media \(prefers-color-scheme: dark\)/);
      const branded = doc.querySelector('[data-grovs-edit-color="--brand"]');
      expect(
        (branded as HTMLElement | null)?.style.getPropertyValue("--brand")
      ).toMatch(/^\s*#[0-9A-F]{6}$/);
    });

    it("puts white button text on its brand colour at WCAG AA", () => {
      const hex = (
        doc.querySelector('[data-grovs-edit-color="--brand"]') as HTMLElement
      ).style
        .getPropertyValue("--brand")
        .trim();
      const luminance = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i]!, 0);
      expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(4.5);
    });

    it("offers its parts in quick edit", () => {
      expect(fieldsOf(e.html).map((f) => `${f.kind}:${f.label}`)).toEqual(
        FIELDS[e.id]
      );
    });

    if (e.layout !== "full")
      it("never makes the root as tall as the screen", () => {
        const css = [...doc.querySelectorAll("style")]
          .map((s) => s.textContent)
          .join("\n");
        for (const [, selector, body] of css.matchAll(/([^{}]*)\{([^{}]*)\}/g))
          if (/(^|[\s,])(html|body|:root)\b/.test(selector!))
            expect(body).not.toMatch(
              /(^|;|\s)(min-|max-)?height\s*:\s*(100%|[\d.]+[sdl]?vh)/
            );
        for (const el of [doc.documentElement, doc.body])
          expect(el.getAttribute("style") ?? "").not.toMatch(/height/);
      });
  });

  it("reads the push permission and hides the button unless it can ask", () => {
    const primer = GALLERY.find((e) => e.id === "push-primer")!.html;
    expect(primer).toContain("grovs.capabilities.pushPermission");
    expect(primer).toContain('"prompt"');
    expect(primer).toContain("grovs.requestPushPermission()");
  });

  it("feedback tracks an event and win-back holds a code to copy", () => {
    const feedback = parse(GALLERY.find((e) => e.id === "feedback")!.html);
    expect(
      feedback.querySelectorAll('[data-grovs-action="track"]').length
    ).toBe(5);
    expect(GALLERY.find((e) => e.id === "win-back")!.html).toContain(
      "clipboard"
    );
  });

  it("the promo video plays inline, muted, from a public https mp4", () => {
    const video = parse(
      GALLERY.find((e) => e.id === "promo-video")!.html
    ).querySelector("video")!;
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(video.hasAttribute("muted")).toBe(true);
    expect(video.getAttribute("src")).toBe(SAMPLE_VIDEO_URL);
    expect(SAMPLE_VIDEO_URL).toMatch(/^https:\/\/.+\.mp4$/);
    expect(video.getAttribute("poster")).toMatch(/^data:image\/svg\+xml,/);
  });
});
