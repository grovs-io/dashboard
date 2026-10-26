import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { htmlProblems, htmlWarnings } from "@ee/lib/inAppHtml";
import { SAMPLE_VIDEO_URL } from "@ee/lib/inAppHtmlGallery";
import Snippets, { SNIPPETS } from "../html/Snippets";

const page = (body: string) =>
  `<!doctype html><html><head></head><body>${body}</body></html>`;

describe("SNIPPETS", () => {
  it("offers the spec's snippets and no close X", () => {
    expect(SNIPPETS.map((s) => s.label)).toEqual([
      "“No thanks” button",
      "Tracked button",
      "Open a link",
      "Push permission button",
      "Sized video",
      "Editable text",
      "Personalized text",
    ]);
    for (const snippet of SNIPPETS)
      expect(snippet.html).not.toMatch(/[×✕✖]|aria-label="close"/i);
  });

  it.each(SNIPPETS.map((s) => [s.label, s.html] as const))(
    "%s passes the checks",
    (_label, html) => {
      expect(htmlProblems(page(html))).toEqual([]);
      expect(htmlWarnings(page(html))).toEqual([]);
    }
  );

  it("the push button only shows while the app can still ask", () => {
    const push = SNIPPETS.find((s) => s.label === "Push permission button")!;
    expect(push.html).toContain(
      'grovs.capabilities.pushPermission !== "prompt"'
    );
    expect(push.html).toContain("grovs.requestPushPermission()");
    expect(push.html).toContain(".catch(");
    // Inserted twice, it must still work: no fixed id.
    expect(push.html).not.toMatch(/\bid=/);
  });

  it("the video uses the gallery's sample clip", () => {
    expect(SNIPPETS.find((s) => s.label === "Sized video")!.html).toContain(
      `src="${SAMPLE_VIDEO_URL}"`
    );
  });
});

describe("Snippets", () => {
  it("inserts the chosen snippet", async () => {
    const onInsert = vi.fn();
    render(<Snippets onInsert={onInsert} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Insert a snippet" })
    );
    await userEvent.click(
      screen.getByRole("menuitem", { name: /Tracked button/ })
    );
    expect(onInsert).toHaveBeenCalledWith(
      SNIPPETS.find((s) => s.label === "Tracked button")!.html
    );
  });
});
