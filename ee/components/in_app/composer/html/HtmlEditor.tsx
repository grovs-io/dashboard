"use client";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import {
  autocompletion,
  completionKeymap,
  type Completion,
  type CompletionContext,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { html } from "@codemirror/lang-html";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { cn } from "@/lib/utils";

export interface HtmlEditorHandle {
  // Replaces the selection, or inserts at the cursor, as if typed.
  insert: (text: string) => void;
}

export interface FieldKeys {
  user: string[];
  event: string[];
}

const BRIDGE: Completion[] = [
  { label: "close", apply: "close()", detail: "Closes the message" },
  {
    label: "track",
    apply: 'track("event_name")',
    detail: "Records an event; the first counts as the click",
  },
  {
    label: "open",
    apply: 'open("https://")',
    detail: "Opens a link, then closes",
  },
  {
    label: "setAttribute",
    apply: 'setAttribute("key", "value")',
    detail: "Sets an attribute of the person",
  },
  {
    label: "requestPushPermission",
    apply: "requestPushPermission()",
    detail: 'Resolves to "granted", "denied" or "unsupported"',
  },
  { label: "user", detail: "The person's attributes" },
  { label: "event", detail: "The triggering event's properties" },
  { label: "capabilities", detail: "pushPermission, without asking" },
].map((c) => ({ ...c, type: "function" }));

const ATTRIBUTES: Completion[] = [
  { label: "data-grovs-action", detail: "close, open or track on a tap" },
  { label: "data-grovs-url", detail: "The link data-grovs-action=open opens" },
  {
    label: "data-grovs-event",
    detail: "The event data-grovs-action=track records",
  },
  {
    label: "data-grovs-edit",
    detail: "Editable in quick edit, with this label",
  },
  {
    label: "data-grovs-edit-color",
    detail: "A colour quick edit can change, such as --brand",
  },
].map((c) => ({ ...c, type: "property" }));

const ACTIONS: Completion[] = ["close", "open", "track"].map((label) => ({
  label,
  type: "enum",
}));

// What to offer at the end of `before`, the text of the line up to the cursor.
export function grovsCompletions(
  before: string,
  fields: FieldKeys
): { from: number; options: Completion[] } | null {
  const at = (match: RegExpExecArray, part: string) =>
    match.index + match[0].length - part.length;
  const bridge = /\bgrovs\.([A-Za-z]*)$/.exec(before);
  if (bridge) return { from: at(bridge, bridge[1]!), options: BRIDGE };
  const action = /data-grovs-action=["']([a-z]*)$/.exec(before);
  if (action) return { from: at(action, action[1]!), options: ACTIONS };
  const attribute = /\b(data-[a-z-]*)$/.exec(before);
  if (attribute)
    return { from: at(attribute, attribute[1]!), options: ATTRIBUTES };
  const field = /\{\{\s*([A-Za-z0-9_.]*)$/.exec(before);
  if (field)
    return {
      from: at(field, field[1]!),
      options: [
        ...fields.user.map((key) => `user.${key}`),
        ...fields.event.map((key) => `event.${key}`),
      ].map((label) => ({ label, type: "variable" })),
    };
  return null;
}

const theme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "12px",
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
  },
  ".cm-scroller": { fontFamily: "var(--font-mono, ui-monospace, monospace)" },
  ".cm-gutters": {
    backgroundColor: "var(--muted)",
    color: "var(--muted-foreground)",
    border: "none",
  },
  "&.cm-focused": { outline: "none" },
});

export default function HtmlEditor({
  ref,
  value,
  onChange,
  fields,
  label = "HTML",
  readOnly = false,
  className,
}: {
  ref?: Ref<HtmlEditorHandle>;
  value: string;
  onChange: (value: string) => void;
  fields: FieldKeys;
  label?: string;
  readOnly?: boolean;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const extensions = useRef<Extension[]>([]);
  // The editor is built once; these let it see the newest props without being rebuilt.
  const latest = useRef({ onChange, fields });
  useEffect(() => {
    latest.current = { onChange, fields };
  });

  useImperativeHandle(
    ref,
    () => ({
      insert: (text) => {
        const editor = view.current;
        if (!editor) return;
        const { state } = editor;
        const end = state.doc.toString().lastIndexOf("</body>");
        // An editor never clicked has its cursor before the doctype.
        const atStart =
          state.selection.main.empty && state.selection.main.head === 0;
        editor.dispatch({
          ...(atStart && end >= 0
            ? {
                changes: { from: end, insert: text },
                selection: { anchor: end + text.length },
              }
            : state.replaceSelection(text)),
          scrollIntoView: true,
          userEvent: "input.paste",
        });
        editor.focus();
      },
    }),
    []
  );

  useEffect(() => {
    const source = (context: CompletionContext) => {
      const line = context.state.doc.lineAt(context.pos);
      const found = grovsCompletions(
        line.text.slice(0, context.pos - line.from),
        latest.current.fields
      );
      return found && { ...found, from: line.from + found.from };
    };
    extensions.current = [
      lineNumbers(),
      history(),
      html(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      autocompletion(),
      EditorState.languageData.of(() => [{ autocomplete: source }]),
      keymap.of([...completionKeymap, ...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      EditorState.readOnly.of(readOnly),
      EditorView.contentAttributes.of({ "aria-label": label }),
      theme,
      EditorView.updateListener.of((update) => {
        if (update.docChanged)
          latest.current.onChange(update.state.doc.toString());
      }),
    ];
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({ doc: value, extensions: extensions.current }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // Built once; value changes arrive through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, readOnly]);

  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() === value) return;
    // A fresh state: not echoed back, and old undo steps can't replay onto the new text.
    const { anchor, head } = editor.state.selection.main;
    const clamp = (at: number) => Math.min(at, value.length);
    editor.setState(
      EditorState.create({
        doc: value,
        selection: { anchor: clamp(anchor), head: clamp(head) },
        extensions: extensions.current,
      })
    );
  }, [value]);

  return (
    <div
      ref={host}
      className={cn(
        "h-[360px] overflow-hidden rounded-lg border border-input [&_.cm-editor]:h-full",
        className
      )}
    />
  );
}
