import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { undo } from "@codemirror/commands";
import HtmlEditor, {
  grovsCompletions,
  type HtmlEditorHandle,
} from "../html/HtmlEditor";

const fields = { user: ["first_name", "plan"], event: ["total"] };
const labels = (before: string) =>
  grovsCompletions(before, fields)?.options.map((o) => o.label);

describe("grovsCompletions", () => {
  it("offers the bridge after grovs.", () => {
    const found = grovsCompletions("<script>grovs.tr", fields)!;
    expect(found.from).toBe("<script>grovs.".length);
    expect(found.options.map((o) => o.label)).toEqual([
      "close",
      "track",
      "open",
      "setAttribute",
      "requestPushPermission",
      "user",
      "event",
      "capabilities",
    ]);
    expect(found.options.find((o) => o.label === "track")!.apply).toBe(
      'track("event_name")'
    );
  });

  it("offers the declarative attributes and their actions", () => {
    const found = grovsCompletions("<button data-grovs-ac", fields)!;
    expect(found.from).toBe("<button ".length);
    expect(found.options.map((o) => o.label)).toEqual([
      "data-grovs-action",
      "data-grovs-url",
      "data-grovs-event",
      "data-grovs-edit",
      "data-grovs-edit-color",
    ]);
    expect(labels('<a data-grovs-action="')).toEqual([
      "close",
      "open",
      "track",
    ]);
  });

  it("offers the person's and the event's fields inside {{", () => {
    const found = grovsCompletions("<p>Hi {{ us", fields)!;
    expect(found.from).toBe("<p>Hi {{ ".length);
    expect(found.options.map((o) => o.label)).toEqual([
      "user.first_name",
      "user.plan",
      "event.total",
    ]);
    expect(labels("{{user.")).toContain("user.plan");
  });

  it("offers nothing elsewhere", () => {
    expect(grovsCompletions("<p>Hello", fields)).toBeNull();
    expect(grovsCompletions("{{ user.x }} more", fields)).toBeNull();
  });
});

describe("HtmlEditor", () => {
  it("shows the html and reports each edit", async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <HtmlEditor value="<p>Hi</p>" onChange={onChange} fields={fields} />
    );
    const content = container.querySelector(".cm-content")!;
    expect(content.getAttribute("aria-label")).toBe("HTML");
    const view = EditorView.findFromDOM(
      container.querySelector(".cm-editor") as HTMLElement
    )!;
    expect(view.state.doc.toString()).toBe("<p>Hi</p>");
    view.dispatch({ changes: { from: 9, insert: "!" } });
    expect(onChange).toHaveBeenLastCalledWith("<p>Hi</p>!");
    // A new value from outside, such as another variant, replaces the text without echoing it.
    onChange.mockClear();
    rerender(
      <HtmlEditor value="<p>B</p>" onChange={onChange} fields={fields} />
    );
    await waitFor(() => expect(view.state.doc.toString()).toBe("<p>B</p>"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("inserts at the cursor, replacing the selection, as a typed edit", () => {
    const onChange = vi.fn();
    const handle = createRef<HtmlEditorHandle>();
    const { container } = render(
      <HtmlEditor
        ref={handle}
        value="<p>AB</p>"
        onChange={onChange}
        fields={fields}
      />
    );
    const view = EditorView.findFromDOM(
      container.querySelector(".cm-editor") as HTMLElement
    )!;
    view.dispatch({ selection: { anchor: 4 } });
    act(() => handle.current!.insert("<b>X</b>"));
    expect(onChange).toHaveBeenLastCalledWith("<p>A<b>X</b>B</p>");
    expect(view.state.selection.main.head).toBe(4 + "<b>X</b>".length);
    view.dispatch({ selection: { anchor: 3, head: 4 + 8 } });
    act(() => handle.current!.insert("Z"));
    expect(onChange).toHaveBeenLastCalledWith("<p>ZB</p>");
    undo(view);
    expect(view.state.doc.toString()).toBe("<p>A<b>X</b>B</p>");
  });

  it("never undoes into a value set from outside", async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <HtmlEditor value="<p>A</p>" onChange={onChange} fields={fields} />
    );
    const view = EditorView.findFromDOM(
      container.querySelector(".cm-editor") as HTMLElement
    )!;
    rerender(
      <HtmlEditor value="<p>B</p>" onChange={onChange} fields={fields} />
    );
    await waitFor(() => expect(view.state.doc.toString()).toBe("<p>B</p>"));
    undo(view);
    expect(view.state.doc.toString()).toBe("<p>B</p>");
    expect(onChange).not.toHaveBeenCalledWith("<p>A</p>");
  });

  it("drops typed undo steps when a value arrives from outside", async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <HtmlEditor value="<p>A</p>" onChange={onChange} fields={fields} />
    );
    const view = EditorView.findFromDOM(
      container.querySelector(".cm-editor") as HTMLElement
    )!;
    view.dispatch({ changes: { from: 4, insert: "typed" } });
    const outside = "<!doctype html><html><body><p>Longer</p></body></html>";
    rerender(
      <HtmlEditor value={outside} onChange={onChange} fields={fields} />
    );
    await waitFor(() => expect(view.state.doc.toString()).toBe(outside));
    onChange.mockClear();
    undo(view);
    expect(view.state.doc.toString()).toBe(outside);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the cursor where it was when a value arrives from outside", async () => {
    const { container, rerender } = render(
      <HtmlEditor value="<p>Hello</p>" onChange={vi.fn()} fields={fields} />
    );
    const view = EditorView.findFromDOM(
      container.querySelector(".cm-editor") as HTMLElement
    )!;
    act(() => view.dispatch({ selection: { anchor: 5, head: 8 } }));
    rerender(
      <HtmlEditor value="<p>Hellos</p>" onChange={vi.fn()} fields={fields} />
    );
    await waitFor(() =>
      expect(view.state.doc.toString()).toBe("<p>Hellos</p>")
    );
    expect(view.state.selection.main).toMatchObject({ anchor: 5, head: 8 });
    rerender(<HtmlEditor value="<p>" onChange={vi.fn()} fields={fields} />);
    await waitFor(() => expect(view.state.doc.toString()).toBe("<p>"));
    expect(view.state.selection.main).toMatchObject({ anchor: 3, head: 3 });
  });
});
