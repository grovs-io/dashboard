"use client";
import {
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import {
  CircleAlert,
  CircleCheck,
  Code2,
  FilePlus2,
  LayoutTemplate,
  PenLine,
  SlidersHorizontal,
} from "lucide-react";
import ActionConfirm from "@/components/common/action-confirm";
import { FieldError } from "@/components/common/FieldError";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { LAYOUT_LABELS } from "@ee/lib/inApp";
import {
  HTML_MAX_BYTES,
  htmlBytes,
  htmlLayout,
  htmlProblems,
  htmlWarnings,
  mediaKind,
  mediaTag,
} from "@ee/lib/inAppHtml";
import type { InAppDraft, VariantKey } from "@ee/lib/inAppComposer";
import { GALLERY, type GalleryExample } from "@ee/lib/inAppHtmlGallery";
import { applyField, fieldsOf } from "@ee/lib/inAppQuickEdit";
import type { InAppSuggestions } from "@ee/hooks/queries/useInAppSuggestions";
import { IN_APP_LAYOUTS, type InAppMedia } from "@ee/types/inApp";
import { Choice } from "@/components/composer/fields";
import Gallery, { Thumb } from "./Gallery";
import HtmlEditor, { type HtmlEditorHandle } from "./HtmlEditor";
import HowItWorks from "./HowItWorks";
import HtmlPreview from "./HtmlPreview";
import { MediaInsert, mediaName } from "./MediaPanel";
import QuickEdit from "./QuickEdit";
import Snippets from "./Snippets";

const LAYOUTS = IN_APP_LAYOUTS.map((value) => ({
  value,
  label: LAYOUT_LABELS[value],
}));

const kilobytes = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

const counted = (n: number, word: string) =>
  `${n} ${word}${n === 1 ? "" : "s"}`;

const segment = (on: boolean) =>
  cn(
    "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
    on
      ? "bg-accent text-primary"
      : "text-muted-foreground hover:text-foreground"
  );

type Tab = "quick" | "code";

function Size({ bytes }: { bytes: number }) {
  return (
    <span
      className={cn(
        "text-xs",
        bytes > HTML_MAX_BYTES ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {kilobytes(bytes)} of 64 KB
    </span>
  );
}

function Counts({
  problems,
  warnings,
}: {
  problems: number;
  warnings: number;
}) {
  if (!problems && !warnings)
    return <span className="text-valid-green">No problems</span>;
  return (
    <>
      {problems > 0 && (
        <span className="text-destructive">{counted(problems, "problem")}</span>
      )}
      {warnings > 0 && (
        <span className="text-amber-600 dark:text-amber-400">
          {counted(warnings, "warning")}
        </span>
      )}
    </>
  );
}

export default function HtmlSection({
  draft,
  set,
  setHtml,
  suggestions,
  media,
  upload,
  variant = "a",
  onEditingChange,
}: {
  // The selected variant's view of the draft.
  draft: InAppDraft;
  set: (patch: Partial<InAppDraft>) => void;
  // Changes this variant's newest HTML, even after this section is gone.
  setHtml: (update: (html: string) => string) => void;
  suggestions: InAppSuggestions;
  media?: ReactNode;
  // Uploads a file for quick edit and returns its address; throws when it can't.
  upload?: (file: File) => Promise<string>;
  variant?: VariantKey;
  // Lets the composer drop its own preview while this window shows one.
  onEditingChange?: (editing: boolean) => void;
}) {
  const bytes = htmlBytes(draft.html);
  // Parsing up to 64 KB waits until typing leaves the browser time for it.
  const checked = useDeferredValue(draft.html);
  const problems = htmlProblems(checked);
  const warnings = htmlWarnings(checked);
  const madeFor = htmlLayout(checked);
  const dark = useTheme().resolvedTheme === "dark";
  const editor = useRef<HtmlEditorHandle>(null);
  const [tab, setTab] = useState<Tab>(() =>
    fieldsOf(draft.html).length ? "quick" : "code"
  );
  const [editing, setEditing] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  // An example waiting for the person to agree to replace their own HTML.
  const [replacing, setReplacing] = useState<GalleryExample | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const [area, setArea] = useState<HTMLElement | null>(null);
  const [room, setRoom] = useState({ width: 440, height: 560 });
  useEffect(() => {
    if (!area || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      // Not laid out yet, such as while the window opens: keep the last real size.
      if (width < 160 || height < 400) return;
      // Leaves room for the preview's toggles, notes and call log.
      setRoom({ width, height: height - 300 });
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, [area]);
  const latest = useRef(onEditingChange);
  useEffect(() => {
    latest.current = onEditingChange;
  });
  useEffect(() => {
    latest.current?.(editing);
  }, [editing]);
  useEffect(() => () => latest.current?.(false), []);
  const empty = !draft.html.trim();
  const withEvent = draft.triggers.some((t) => t.type === "event");
  const title = draft.variants.length
    ? `Design · Variant ${variant.toUpperCase()}`
    : "Design";

  const choose = (next: Tab) => {
    setTab(next);
    setPicked(null);
  };
  const edit = (open: boolean) => {
    setEditing(open);
    if (!open) setPicked(null);
  };
  const start = (example: GalleryExample) => {
    set({ html: example.html, layout: example.layout });
    choose(fieldsOf(example.html).length ? "quick" : "code");
    setBrowsing(false);
    setReplacing(null);
    setEditing(true);
  };
  const pick = (example: GalleryExample) =>
    empty || GALLERY.some((e) => e.html === draft.html)
      ? start(example)
      : setReplacing(example);

  const insertCode = (text: string) => {
    // Shown before inserting, so the editor can take focus and scroll to it.
    flushSync(() => choose("code"));
    editor.current?.insert(text);
  };
  const insertMedia = (
    item: InAppMedia,
    size?: { width: number; height: number }
  ) => {
    const kind = mediaKind(item.type, mediaName(item.url));
    if (!kind) return;
    const field =
      tab === "quick" && picked
        ? fieldsOf(draft.html).find((f) => f.key === picked && f.kind === kind)
        : undefined;
    if (field)
      return set({ html: applyField(draft.html, field, item.url, size) });
    insertCode(mediaTag(kind, item.url, size));
  };

  return (
    <div className="space-y-5">
      {empty ? (
        <div className="space-y-3 rounded-lg border border-dashed border-sidebar-border p-4">
          <div className="space-y-0.5">
            <p className="text-[13px] font-medium">Start from an example</p>
            <p className="text-xs text-muted-foreground">
              Ready-made designs for phones and browsers, light and dark. Change
              the words, pictures and colours in quick edit.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => setBrowsing(true)}>
              <LayoutTemplate className="size-4" />
              Browse examples
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => start(GALLERY.find((e) => e.id === "blank")!)}
            >
              <FilePlus2 className="size-4" />
              Start blank
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-4 rounded-lg border border-sidebar-border p-4">
          {editing ? (
            <div className="h-[209px] w-[100px] shrink-0 rounded-[14px] bg-muted" />
          ) : (
            <Thumb
              html={checked}
              layout={draft.layout}
              title="Your design"
              dark={dark}
              scale={0.24}
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="space-y-1">
              <p className="text-[13px] font-medium">
                {LAYOUT_LABELS[draft.layout]}
              </p>
              <p>
                <Size bytes={bytes} />
              </p>
              <p className="flex flex-wrap gap-x-2 text-xs font-medium">
                <Counts problems={problems.length} warnings={warnings.length} />
              </p>
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <Button
                ref={editButton}
                type="button"
                size="sm"
                onClick={() => edit(true)}
              >
                <PenLine className="size-4" />
                Edit design
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBrowsing(true)}
              >
                <LayoutTemplate className="size-4" />
                Browse examples
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={editing} onOpenChange={edit}>
        <DialogContent
          showCloseButton={false}
          // Escape in the code closes its completions, not the window.
          onEscapeKeyDown={(e) =>
            (e.target as Element).closest?.(".cm-editor") && e.preventDefault()
          }
          onCloseAutoFocus={(e) => {
            if (!editButton.current) return;
            e.preventDefault();
            editButton.current.focus();
          }}
          className="flex h-[92vh] w-[96vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        >
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-sidebar-border px-5 py-3">
            <DialogTitle className="mr-auto text-[15px]">{title}</DialogTitle>
            <DialogDescription className="sr-only">
              Edit the message and see it as people will.
            </DialogDescription>
            <Choice
              label="Layout"
              className="h-8 w-48"
              value={draft.layout}
              options={LAYOUTS}
              onChange={(layout) => set({ layout })}
            />
            <Size bytes={bytes} />
            <Popover modal>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-2 px-2 text-xs font-medium"
                >
                  {problems.length || warnings.length ? (
                    <CircleAlert
                      className={cn(
                        "size-4",
                        problems.length ? "text-destructive" : "text-amber-500"
                      )}
                    />
                  ) : (
                    <CircleCheck className="size-4 text-valid-green" />
                  )}
                  <Counts
                    problems={problems.length}
                    warnings={warnings.length}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="max-h-[60vh] w-96 space-y-2 overflow-y-auto"
              >
                {problems.length + warnings.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    The HTML has no problems or warnings.
                  </p>
                )}
                {problems.map((problem) => (
                  <FieldError key={problem} message={problem} />
                ))}
                {warnings.map((warning) => (
                  <p
                    key={warning}
                    className="text-xs text-amber-600 dark:text-amber-400"
                  >
                    {warning}
                  </p>
                ))}
              </PopoverContent>
            </Popover>
            <HowItWorks onInsert={insertCode} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setBrowsing(true)}
            >
              <LayoutTemplate className="size-4" />
              Examples
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8"
              onClick={() => edit(false)}
            >
              Done
            </Button>
          </div>
          {madeFor && madeFor !== draft.layout && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 border-b border-sidebar-border bg-amber-50 px-5 py-1.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <span>
                This design is made for {LAYOUT_LABELS[madeFor]}. It may not fit
                as {LAYOUT_LABELS[draft.layout]}.
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => set({ layout: madeFor })}
              >
                Use {LAYOUT_LABELS[madeFor]}
              </Button>
            </div>
          )}

          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,40fr)_minmax(0,35fr)_minmax(0,25fr)] lg:overflow-hidden">
            <section
              aria-label="Edit"
              className="flex min-h-[560px] flex-col lg:min-h-0 lg:border-r lg:border-sidebar-border"
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-4 py-2">
                <div
                  role="tablist"
                  aria-label="How to edit"
                  className="inline-flex rounded-lg border border-sidebar-border bg-background p-0.5"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === "quick"}
                    onClick={() => choose("quick")}
                    className={segment(tab === "quick")}
                  >
                    <SlidersHorizontal className="size-3.5" />
                    Quick edit
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === "code"}
                    onClick={() => choose("code")}
                    className={segment(tab === "code")}
                  >
                    <Code2 className="size-3.5" />
                    Code
                  </button>
                </div>
                {tab === "code" && (
                  <Snippets onInsert={(html) => editor.current?.insert(html)} />
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {tab === "quick" && (
                  <QuickEdit
                    html={draft.html}
                    onChange={(html) => set({ html })}
                    suggestions={suggestions}
                    withEvent={withEvent}
                    onUpload={upload}
                    picked={picked}
                    onPick={setPicked}
                    setHtml={setHtml}
                  />
                )}
                {/* Hidden, not unmounted, to keep the cursor and typed undo steps; quick-edit changes aren't undoable here. */}
                <div className={cn("h-full", tab !== "code" && "hidden")}>
                  <HtmlEditor
                    ref={editor}
                    className="h-full min-h-[320px]"
                    value={draft.html}
                    onChange={(html) => set({ html })}
                    fields={{
                      user: suggestions.userAttributes,
                      event: suggestions.eventProperties,
                    }}
                  />
                </div>
              </div>
            </section>
            <section
              ref={setArea}
              aria-label="Preview"
              className="flex h-[85vh] justify-center overflow-y-auto bg-sidebar p-5 lg:h-auto lg:min-h-0"
            >
              <HtmlPreview
                html={draft.html}
                layout={draft.layout}
                dismissible={draft.dismissible}
                backdrop={draft.backdrop}
                maxWidth={room.width}
                maxHeight={room.height}
              />
            </section>
            <section
              aria-label="Media"
              className="p-4 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-sidebar-border"
            >
              <MediaInsert value={insertMedia}>{media}</MediaInsert>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={browsing} onOpenChange={setBrowsing}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 border-b border-sidebar-border px-6 py-4 pr-12">
            <DialogTitle>Start from an example</DialogTitle>
            <DialogDescription>
              Each works on phones and in browsers, in light and dark mode, and
              its buttons need no code.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto p-6">
            <Gallery onPick={pick} />
          </div>
        </DialogContent>
      </Dialog>
      <ActionConfirm
        open={replacing !== null}
        setOpen={(open) => !open && setReplacing(null)}
        title={`Replace your HTML with ${replacing?.title ?? "the example"}?`}
        description="The HTML you wrote for this message is replaced, and the code editor cannot undo it."
        confirmText="Replace"
        cancelText="Keep mine"
        onConfirm={() => {
          if (replacing) start(replacing);
        }}
      />

      <div className="divide-y divide-sidebar-border rounded-lg border border-sidebar-border">
        <p className="p-3 text-xs text-muted-foreground">
          The app always draws its own close button on top of the message.
        </p>
        {draft.layout !== "full" && (
          <label className="flex items-center justify-between gap-3 p-3 text-[13px]">
            <span>
              People can close it with a{" "}
              {draft.layout === "modal" ? "tap outside it" : "swipe"}
            </span>
            <Switch
              checked={draft.dismissible}
              onCheckedChange={(dismissible) => set({ dismissible })}
            />
          </label>
        )}
        {draft.layout === "modal" && (
          <label className="flex items-center justify-between gap-3 p-3 text-[13px]">
            Dim the app behind the message
            <Switch
              checked={draft.backdrop === "dim"}
              onCheckedChange={(on) => set({ backdrop: on ? "dim" : "none" })}
            />
          </label>
        )}
      </div>
    </div>
  );
}
