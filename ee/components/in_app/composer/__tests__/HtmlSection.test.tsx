import { beforeAll, describe, expect, it, vi } from "vitest";
import { useEffect, useState, type ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditorView } from "@codemirror/view";
import {
  emptyDraft,
  type InAppDraft,
  type VariantKey,
} from "@ee/lib/inAppComposer";
import { GALLERY } from "@ee/lib/inAppHtmlGallery";
import { mediaTag } from "@ee/lib/inAppHtml";
import type { InAppMedia } from "@ee/types/inApp";
import HtmlSection from "../html/HtmlSection";
import { MediaPanel } from "../html/MediaPanel";
import { SNIPPETS } from "../html/Snippets";

const suggestions = { userAttributes: [], eventProperties: [], loading: false };

let current: InAppDraft;

// CodeMirror measures text to scroll an insert into view; jsdom has no layout.
beforeAll(() => {
  Range.prototype.getClientRects ??= () =>
    ({
      length: 0,
      item: () => null,
      [Symbol.iterator]: [][Symbol.iterator],
    }) as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect ??= () => new DOMRect();
});

const file = (over: Partial<InAppMedia>): InAppMedia => ({
  id: "m1",
  url: "https://cdn.example/media/hero.png",
  type: "image/png",
  bytes: 1000,
  used: false,
  ...over,
});

const FILES = [
  file({}),
  file({
    id: "m2",
    url: "https://cdn.example/media/intro.mp4",
    type: "video/mp4",
  }),
  file({
    id: "m3",
    url: "https://cdn.example/media/song.mp3",
    type: "audio/mpeg",
  }),
];

function Harness({
  html = "",
  variant,
  media,
  onEditingChange,
  upload,
}: {
  html?: string;
  variant?: VariantKey;
  media?: ReactNode;
  onEditingChange?: (editing: boolean) => void;
  upload?: (file: File) => Promise<string>;
}) {
  const [draft, setDraft] = useState<InAppDraft>({
    ...emptyDraft(),
    template: "html",
    html,
    variants:
      variant && variant !== "a" ? [{ id: "b", content: {} } as never] : [],
  });
  useEffect(() => {
    current = draft;
  }, [draft]);
  return (
    <HtmlSection
      draft={draft}
      set={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      setHtml={(update) => setDraft((d) => ({ ...d, html: update(d.html) }))}
      suggestions={suggestions}
      variant={variant}
      media={media}
      onEditingChange={onEditingChange}
      upload={upload}
    />
  );
}

const editor = () =>
  EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!;

const design = () => screen.getByRole("dialog", { name: /^Design/ });

const openEditor = () =>
  userEvent.click(screen.getByRole("button", { name: "Edit design" }));

describe("HtmlSection summary", () => {
  it("shows the design, its size and how many problems it has", async () => {
    render(
      <Harness html='<p>Hi</p><base href="https://x.example/"><img src="https://x.example/a.png">' />
    );
    expect(screen.getByText("Card in the middle")).toBeInTheDocument();
    expect(screen.getByText(/ KB of 64 KB/)).toBeInTheDocument();
    expect(screen.getByText("1 problem")).toHaveClass("text-destructive");
    expect(screen.getByText("1 warning")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    await openEditor();
    expect(design()).toBeInTheDocument();
  });

  it("starts blank with the Blank example in the editor", async () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "Edit design" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Start blank" }));
    const blank = GALLERY.find((e) => e.id === "blank")!;
    expect(current.html).toBe(blank.html);
    expect(current.layout).toBe(blank.layout);
    expect(design()).toBeInTheDocument();
  });

  it("starts from an example, with its layout, in quick edit", async () => {
    render(<Harness />);
    await userEvent.click(
      screen.getByRole("button", { name: "Browse examples" })
    );
    await userEvent.click(
      screen.getByRole("button", { name: /^Announcement/ })
    );
    const example = GALLERY.find((e) => e.id === "announcement-banner")!;
    expect(current.html).toBe(example.html);
    expect(current.layout).toBe("banner_top");
    expect(
      within(design()).getByRole("tab", { name: "Quick edit" })
    ).toHaveAttribute("aria-selected", "true");
    expect(within(design()).getByLabelText("Headline")).toHaveValue(
      "Dark mode is here"
    );
  });

  it("scrolls only the examples, under a header that stays", async () => {
    render(<Harness />);
    await userEvent.click(
      screen.getByRole("button", { name: "Browse examples" })
    );
    const dialog = screen.getByRole("dialog", {
      name: "Start from an example",
    });
    const grid = within(dialog)
      .getByRole("button", { name: /^Blank/ })
      .closest(".grid")!;
    expect(grid.parentElement).toHaveClass("overflow-y-auto");
    expect(dialog).not.toHaveClass("overflow-y-auto");
    expect(grid.className).toContain("minmax(240px,1fr)");
  });
});

describe("HtmlSection editor", () => {
  it("edits the draft live and keeps the edit after closing", async () => {
    render(<Harness html="<p>AB</p>" />);
    await openEditor();
    act(() => editor().dispatch({ changes: { from: 4, insert: "X" } }));
    expect(current.html).toBe("<p>AXB</p>");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(current.html).toBe("<p>AXB</p>");
    await openEditor();
    expect(editor().state.doc.toString()).toBe("<p>AXB</p>");
  });

  it("keeps the window open on Escape in the code, and tells the composer", async () => {
    const onEditingChange = vi.fn();
    render(<Harness html="<p>AB</p>" onEditingChange={onEditingChange} />);
    await openEditor();
    expect(onEditingChange).toHaveBeenLastCalledWith(true);
    fireEvent.keyDown(document.querySelector(".cm-content")!, {
      key: "Escape",
    });
    expect(design()).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onEditingChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("button", { name: "Edit design" })).toHaveFocus();
  });

  it("explains how it works in a side panel, with examples to insert", async () => {
    render(<Harness html="<p>AB</p>" />);
    await openEditor();
    expect(screen.queryByText("How the message talks to the app")).toBeNull();
    act(() => editor().dispatch({ selection: { anchor: 4 } }));
    await userEvent.click(
      within(design()).getByRole("button", { name: "How it works" })
    );
    const panel = screen.getByRole("dialog", { name: "How it works" });
    for (const heading of [
      "Buttons without code",
      "Personalize",
      "JavaScript",
      "Links and media",
      "Good to know",
    ])
      expect(within(panel).getByText(heading)).toBeInTheDocument();
    const close = within(panel)
      .getByText(
        '<button type="button" data-grovs-action="close">No thanks</button>'
      )
      .closest("li")!;
    expect(
      within(close).getByRole("button", { name: "Copy" })
    ).toBeInTheDocument();
    await userEvent.click(
      within(close).getByRole("button", { name: "Insert" })
    );
    expect(current.html).toBe(
      '<p>A<button type="button" data-grovs-action="close">No thanks</button>B</p>'
    );
    expect(screen.queryByRole("dialog", { name: "How it works" })).toBeNull();
  });

  it("suggests the layout a design is made for when another is picked", async () => {
    render(
      <Harness html='<html><head><meta name="grovs-layout" content="full"></head><body><p>Hi</p></body></html>' />
    );
    await openEditor();
    expect(
      within(design()).getByText(
        "This design is made for Full screen. It may not fit as Card in the middle."
      )
    ).toBeInTheDocument();
    await userEvent.click(
      within(design()).getByRole("button", { name: "Use Full screen" })
    );
    expect(current.layout).toBe("full");
    expect(within(design()).queryByText(/is made for/)).toBeNull();
  });

  it("gives no layout hint when the design fits or names no layout", async () => {
    const { unmount } = render(
      <Harness html='<html><head><meta name="grovs-layout" content="modal"></head><body><p>Hi</p></body></html>' />
    );
    await openEditor();
    expect(within(design()).queryByText(/is made for/)).toBeNull();
    unmount();
    render(<Harness html="<p>Hi</p>" />);
    await openEditor();
    expect(within(design()).queryByText(/is made for/)).toBeNull();
    expect(
      within(design()).queryByRole("button", { name: /^Use / })
    ).toBeNull();
  });

  it("names the variant it edits", async () => {
    render(<Harness html="<p>B</p>" variant="b" />);
    await openEditor();
    expect(
      screen.getByRole("dialog", { name: "Design · Variant B" })
    ).toBeInTheDocument();
  });

  it("lists the problems and warnings behind the badge", async () => {
    render(
      <Harness html='<base href="https://x.example/"><img src="https://x.example/a.png">' />
    );
    await openEditor();
    await userEvent.click(
      within(design()).getByRole("button", { name: /1 problem/ })
    );
    expect(await screen.findByText(/<base>/)).toBeInTheDocument();
    expect(screen.getByText(/unsized image or video/)).toBeInTheDocument();
  });

  it("inserts a snippet where the cursor is", async () => {
    render(<Harness html="<p>AB</p>" />);
    await openEditor();
    editor().dispatch({ selection: { anchor: 4 } });
    await userEvent.click(
      screen.getByRole("button", { name: "Insert a snippet" })
    );
    await userEvent.click(
      screen.getByRole("menuitem", { name: /Editable text/ })
    );
    const snippet = SNIPPETS.find((s) => s.label === "Editable text")!.html;
    expect(current.html).toBe(`<p>A${snippet}B</p>`);
  });

  it("asks before an example replaces HTML someone wrote", async () => {
    render(<Harness html="<p>Mine</p>" />);
    await openEditor();
    await userEvent.click(
      within(design()).getByRole("button", { name: "Examples" })
    );
    await userEvent.click(screen.getByRole("button", { name: /^Feedback/ }));
    expect(current.html).toBe("<p>Mine</p>");
    await userEvent.click(screen.getByRole("button", { name: "Keep mine" }));
    expect(current.html).toBe("<p>Mine</p>");
    // The examples stay open, so another can be chosen.
    await userEvent.click(screen.getByRole("button", { name: /^Feedback/ }));
    await userEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(current.html).toBe(GALLERY.find((e) => e.id === "feedback")!.html);
    expect(current.layout).toBe("banner_bottom");
  });
});

describe("HtmlSection media", () => {
  const panel = <MediaPanel items={FILES} onUpload={vi.fn()} />;

  it("inserts each kind of file at the cursor in the code", async () => {
    render(<Harness html="<p>AB</p>" media={panel} />);
    await openEditor();
    editor().dispatch({ selection: { anchor: 4 } });
    const image = screen.getByRole("listitem", { name: "hero.png" });
    const img = image.querySelector("img")!;
    Object.defineProperty(img, "naturalWidth", { value: 1200 });
    Object.defineProperty(img, "naturalHeight", { value: 800 });
    fireEvent.load(img);
    await userEvent.click(
      within(image).getByRole("button", { name: "Insert hero.png" })
    );
    const tag = mediaTag("image", FILES[0]!.url, { width: 1200, height: 800 });
    expect(current.html).toBe(`<p>A${tag}B</p>`);

    await userEvent.click(
      screen.getByRole("button", { name: "Insert intro.mp4" })
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Insert song.mp3" })
    );
    expect(current.html).toBe(
      `<p>A${tag}${mediaTag("video", FILES[1]!.url)}${mediaTag("audio", FILES[2]!.url)}B</p>`
    );
  });

  it("fills the quick-edit field chosen last, or else goes to the code", async () => {
    const html =
      '<img data-grovs-edit="Hero" src="https://x.example/old.png" width="10" height="10"><p data-grovs-edit="Title">Hi</p>';
    render(<Harness html={html} media={panel} />);
    await openEditor();
    expect(
      within(design()).getByRole("tab", { name: "Quick edit" })
    ).toHaveAttribute("aria-selected", "true");
    const img = screen
      .getByRole("listitem", { name: "hero.png" })
      .querySelector("img")!;
    Object.defineProperty(img, "naturalWidth", { value: 1200 });
    Object.defineProperty(img, "naturalHeight", { value: 800 });
    fireEvent.load(img);
    await userEvent.click(screen.getByLabelText("Hero"));
    await userEvent.click(
      screen.getByRole("button", { name: "Insert hero.png" })
    );
    expect(current.html).toContain(
      `src="${FILES[0]!.url}" width="1200" height="800"`
    );
    expect(current.html).not.toContain("old.png");
    expect(screen.getByRole("tab", { name: "Quick edit" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await userEvent.click(screen.getByLabelText("Title"));
    await userEvent.click(
      screen.getByRole("button", { name: "Insert song.mp3" })
    );
    expect(screen.getByRole("tab", { name: "Code" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(current.html).toContain(mediaTag("audio", FILES[2]!.url));
  });

  it("applies a slow upload to the newest HTML after leaving quick edit", async () => {
    const html =
      '<img data-grovs-edit="Hero" src="https://x.example/old.png" width="10" height="10"><p data-grovs-edit="Title">Hi</p>';
    let finish: (url: string) => void = () => {};
    const upload = vi.fn(
      () => new Promise<string>((resolve) => (finish = resolve))
    );
    render(<Harness html={html} upload={upload} />);
    await openEditor();
    await userEvent.upload(
      screen.getByLabelText("Upload Hero"),
      new File(["x"], "new.png", { type: "image/png" })
    );
    expect(upload).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("tab", { name: "Code" }));
    const at = editor().state.doc.toString().indexOf("Hi");
    act(() => editor().dispatch({ changes: { from: at, insert: "Newer " } }));
    expect(current.html).toContain("Newer Hi");
    await act(async () => finish("https://cdn.example/new.png"));
    expect(current.html).toContain("Newer Hi");
    expect(current.html).toContain('src="https://cdn.example/new.png"');
    expect(current.html).not.toContain("old.png");
  });

  it("puts a file before </body> when the code was never clicked", async () => {
    const html =
      '<!doctype html><html><body><p data-grovs-edit="Title">Hi</p></body></html>';
    render(<Harness html={html} media={panel} />);
    await openEditor();
    await userEvent.click(
      screen.getByRole("button", { name: "Insert song.mp3" })
    );
    expect(current.html).toBe(
      `<!doctype html><html><body><p data-grovs-edit="Title">Hi</p>${mediaTag("audio", FILES[2]!.url)}</body></html>`
    );
  });

  it("forgets the picked field once the window closes", async () => {
    const html =
      '<img data-grovs-edit="Hero" src="https://x.example/old.png" width="10" height="10">';
    render(<Harness html={html} media={panel} />);
    await openEditor();
    await userEvent.click(screen.getByLabelText("Hero"));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await openEditor();
    await userEvent.click(
      screen.getByRole("button", { name: "Insert hero.png" })
    );
    expect(current.html).toContain("old.png");
    expect(screen.getByRole("tab", { name: "Code" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("sizes the preview to its column, ignoring a size of nothing", async () => {
    let report: (width: number, height: number) => void = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          report = (width, height) =>
            callback(
              [{ contentRect: { width, height } } as ResizeObserverEntry],
              this as unknown as ResizeObserver
            );
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      }
    );
    render(<Harness html="<p>Hi</p>" />);
    await openEditor();
    const box = () =>
      screen.getByTitle("Message preview").parentElement!.parentElement!
        .parentElement!;
    act(() => report(0, 0));
    expect(parseFloat(box().style.width)).toBeGreaterThan(100);
    act(() => report(300, 800));
    expect(parseFloat(box().style.width)).toBeCloseTo(390 * (500 / 844), 1);
    vi.unstubAllGlobals();
  });
});
