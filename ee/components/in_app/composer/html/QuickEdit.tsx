"use client";
import { useId, useRef, useState } from "react";
import { FileAudio, FileVideo, Loader2, Upload } from "lucide-react";
import { FieldError } from "@/components/common/FieldError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { insertAt } from "@ee/lib/inAppComposer";
import { mediaKind, mediaProblem } from "@ee/lib/inAppHtml";
import { linkAllowed, resourceAllowed } from "@ee/lib/inAppLinkRule";
import {
  applyField,
  fieldsOf,
  type ButtonValue,
  type Field,
  type QuickAction,
} from "@ee/lib/inAppQuickEdit";
import type { InAppSuggestions } from "@ee/hooks/queries/useInAppSuggestions";
import ColorField from "@/components/composer/ColorField";
import InsertField from "../InsertField";
import { Choice } from "@/components/composer/fields";
import { uploadErrorText } from "./MediaPanel";

type MediaField = Extract<Field, { kind: "image" | "video" | "audio" }>;

const ACTIONS = [
  { value: "close" as const, label: "Close the message" },
  { value: "open" as const, label: "Open a link" },
  { value: "track" as const, label: "Track an event" },
];

const ACCEPT: Record<MediaField["kind"], string> = {
  image: "image/png,image/jpeg,image/gif",
  video: "video/mp4",
  audio: "audio/mpeg,audio/mp4,audio/x-m4a,.mp3,.m4a",
};

const WRONG_KIND: Record<MediaField["kind"], string> = {
  image: "Choose a PNG, JPEG or GIF image.",
  video: "Choose an MP4 video.",
  audio: "Choose an MP3 or M4A audio file.",
};

const tidy = (text: string) => text.replace(/\s+/g, " ").trim();

// What was typed, kept while the HTML reads the same: the HTML drops a trailing space as it is typed.
function useTyped(value: string) {
  const [typed, setTyped] = useState(value);
  if (tidy(typed) !== value) setTyped(value);
  return [tidy(typed) === value ? typed : value, setTyped] as const;
}

const switchAction = (
  type: QuickAction["type"],
  from: QuickAction
): QuickAction =>
  type === "open"
    ? { type, url: from.type === "open" ? from.url : "https://" }
    : type === "track"
      ? { type, event: from.type === "track" ? from.event : "button_tapped" }
      : { type };

function TextField({
  field,
  onChange,
  suggestions,
  withEvent,
}: {
  field: Extract<Field, { kind: "text" }>;
  onChange: (value: string) => void;
  suggestions: InAppSuggestions;
  withEvent: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const [typed, setTyped] = useTyped(field.value);
  const change = (value: string) => {
    setTyped(value);
    onChange(value);
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-[13px]">
          {field.label}
        </Label>
        <InsertField
          target={field.label}
          suggestions={suggestions}
          withEvent={withEvent}
          onInsert={(text) => {
            const el = input.current;
            change(
              insertAt(
                typed,
                text,
                el?.selectionStart ?? null,
                el?.selectionEnd ?? null
              )
            );
            el?.focus();
          }}
        />
      </div>
      <Textarea
        id={id}
        ref={input}
        rows={1}
        className="min-h-9 resize-none py-1.5"
        value={typed}
        // A line break shows as a space in HTML, so Enter does nothing here.
        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        onChange={(e) => change(e.target.value.replace(/\n/g, " "))}
      />
    </div>
  );
}

function ButtonField({
  field,
  onChange,
}: {
  field: Extract<Field, { kind: "button" }>;
  onChange: (value: ButtonValue) => void;
}) {
  const id = useId();
  const { action } = field.value;
  const [text, setText] = useTyped(field.value.text ?? "");
  const set = (patch: Partial<ButtonValue>) =>
    onChange({ ...field.value, ...patch });
  return (
    <div className="space-y-2 rounded-lg border border-sidebar-border p-3">
      <Label htmlFor={id} className="text-[13px]">
        {field.label}
      </Label>
      {field.value.text !== null && (
        <Input
          id={id}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            set({ text: e.target.value });
          }}
        />
      )}
      <Choice
        label={`${field.label} action`}
        value={action.type}
        options={ACTIONS}
        onChange={(type) => set({ action: switchAction(type, action) })}
      />
      {action.type === "open" && (
        <>
          <Input
            aria-label={`${field.label} link`}
            placeholder="https://example.com/offer or myapp://offer"
            value={action.url}
            aria-invalid={!linkAllowed(action.url)}
            onChange={(e) =>
              set({ action: { type: "open", url: e.target.value } })
            }
          />
          {!linkAllowed(action.url) && (
            <FieldError message="Use an https:// link or an app link such as myapp://." />
          )}
        </>
      )}
      {action.type === "track" && (
        <>
          <Input
            aria-label={`${field.label} event`}
            placeholder="event_name"
            maxLength={100}
            value={action.event}
            aria-invalid={!action.event.trim()}
            onChange={(e) =>
              set({ action: { type: "track", event: e.target.value } })
            }
          />
          {!action.event.trim() && <FieldError message="Name the event." />}
        </>
      )}
    </div>
  );
}

function MediaInput({
  field,
  picked,
  onChange,
  onUpload,
}: {
  field: MediaField;
  picked: boolean;
  onChange: (value: string) => void;
  onUpload?: (file: File) => Promise<void>;
}) {
  const id = useId();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const take = async (chosen: File) => {
    const problem =
      mediaKind(chosen.type, chosen.name) !== field.kind
        ? WRONG_KIND[field.kind]
        : mediaProblem(chosen, []);
    setError(problem);
    if (problem || !onUpload) return;
    setBusy(true);
    try {
      await onUpload(chosen);
    } catch (e) {
      setError(uploadErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  const allowed = resourceAllowed(field.value, field.kind === "image");
  return (
    <div
      data-media-field={field.key}
      className={cn(
        "space-y-1.5 rounded-sm",
        picked && "ring-2 ring-primary/40 ring-offset-4 ring-offset-background"
      )}
    >
      <Label htmlFor={id} className="text-[13px]">
        {field.label}
      </Label>
      <div className="flex items-center gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-sidebar-border bg-muted">
          {field.kind === "image" ? (
            allowed && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={field.value}
                alt=""
                className="size-full object-cover"
              />
            )
          ) : field.kind === "video" ? (
            <FileVideo className="size-4 text-muted-foreground" />
          ) : (
            <FileAudio className="size-4 text-muted-foreground" />
          )}
        </span>
        <Input
          id={id}
          className="min-w-0 font-mono text-xs"
          placeholder="https://"
          value={field.value.startsWith("data:") ? "" : field.value}
          aria-invalid={!allowed}
          onChange={(e) => onChange(e.target.value.trim())}
        />
        {onUpload && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              disabled={busy}
              onClick={() => file.current?.click()}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              Upload
            </Button>
            <input
              ref={file}
              type="file"
              className="hidden"
              aria-label={`Upload ${field.label}`}
              accept={ACCEPT[field.kind]}
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                e.target.value = "";
                if (chosen) void take(chosen);
              }}
            />
          </>
        )}
      </div>
      {field.value.startsWith("data:") && (
        <p className="text-xs text-muted-foreground">
          A built-in picture. Upload your own or paste an https:// address.
        </p>
      )}
      {picked && (
        <p className="text-xs text-muted-foreground">
          Insert a file from Media to put it here.
        </p>
      )}
      {!allowed && (
        <FieldError message="Use an https:// address, or upload a file." />
      )}
      <FieldError message={error ?? undefined} />
    </div>
  );
}

export default function QuickEdit({
  html,
  onChange,
  suggestions,
  withEvent,
  onUpload,
  picked = null,
  onPick,
  setHtml,
}: {
  html: string;
  onChange: (html: string) => void;
  suggestions: InAppSuggestions;
  withEvent: boolean;
  // Uploads a file for the message and returns its address; throws when it can't.
  onUpload?: (file: File) => Promise<string>;
  // The picture, video or sound field focused last, which Insert in the media panel fills.
  picked?: string | null;
  onPick?: (key: string | null) => void;
  // Updates the owner's newest HTML, so an upload that ends after more edits or after this unmounts keeps them.
  setHtml: (update: (html: string) => string) => void;
}) {
  const fields = fieldsOf(html);
  const apply = <F extends Field>(field: F, value: F["value"]) =>
    onChange(applyField(html, field, value));

  if (!fields.length)
    return (
      <div className="space-y-1.5 rounded-lg border border-dashed border-sidebar-border p-4 text-xs text-muted-foreground">
        <p className="text-[13px] font-medium text-foreground">
          Nothing to edit here yet
        </p>
        <p>
          In the code, mark a heading, text, image, video or button with{" "}
          <code className="rounded bg-muted px-1 font-mono text-[11px]">
            data-grovs-edit=&quot;Headline&quot;
          </code>{" "}
          and it shows up here. For a colour, add{" "}
          <code className="rounded bg-muted px-1 font-mono text-[11px]">
            data-grovs-edit-color=&quot;--brand&quot;
          </code>{" "}
          to an element whose style sets{" "}
          <code className="rounded bg-muted px-1 font-mono text-[11px]">
            --brand
          </code>
          .
        </p>
      </div>
    );

  const colors = fields.filter((f) => f.kind === "color");
  const rest = fields.filter((f) => f.kind !== "color");
  return (
    <div
      className="space-y-4"
      onFocus={(e) =>
        onPick?.(
          e.target.closest<HTMLElement>("[data-media-field]")?.dataset
            .mediaField ?? null
        )
      }
    >
      {colors.length > 0 && (
        <div className="divide-y divide-sidebar-border overflow-hidden rounded-lg border border-sidebar-border">
          {colors.map((field) => (
            <ColorField
              key={field.key}
              label={field.label}
              value={field.value || undefined}
              fallback={field.value || "#000000"}
              automatic={false}
              onChange={(value) => value && apply(field, value)}
            />
          ))}
        </div>
      )}
      {rest.map((field) => {
        switch (field.kind) {
          case "text":
            return (
              <TextField
                key={field.key}
                field={field}
                suggestions={suggestions}
                withEvent={withEvent}
                onChange={(value) => apply(field, value)}
              />
            );
          case "button":
            return (
              <ButtonField
                key={field.key}
                field={field}
                onChange={(value) => apply(field, value)}
              />
            );
          default:
            return (
              <MediaInput
                key={field.key}
                field={field as MediaField}
                picked={picked === field.key}
                onChange={(value) => apply(field, value)}
                onUpload={
                  onUpload &&
                  (async (file) => {
                    const url = await onUpload(file);
                    setHtml((now) => applyField(now, field as MediaField, url));
                  })
                }
              />
            );
        }
      })}
    </div>
  );
}
