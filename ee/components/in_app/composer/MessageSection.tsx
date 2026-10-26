"use client";
import { useRef, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  MessageCircleQuestion,
  MousePointerClick,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/common/FieldError";
import { ACTION_LABELS, HTML_TEMPLATE_NOTE, TEMPLATES } from "@ee/lib/inApp";
import {
  ALERT_LIMITS,
  MAX_BUTTONS,
  alertButtonProblem,
  alertLimitProblems,
  alertMessageProblem,
  alertTitleProblem,
  blankQuestion,
  charCount,
  insertAt,
  nextButtonId,
  questionTemplateProblem,
  questionTemplateReason,
  type InAppDraft,
  type VariantKey,
} from "@ee/lib/inAppComposer";
import type { InAppSuggestions } from "@ee/hooks/queries/useInAppSuggestions";
import {
  IN_APP_ACTIONS,
  IN_APP_TEMPLATES,
  type InAppImageSlot,
} from "@ee/types/inApp";
import { Choice } from "@/components/composer/fields";
import ActionEditor from "./ActionEditor";
import ColorsSection from "./ColorsSection";
import ImageTile from "./ImageTile";
import InsertField from "./InsertField";
import OptionCard from "@/components/composer/OptionCard";
import QuestionEditor from "./QuestionEditor";
import LockedNotice from "./LockedNotice";
import TemplatePicker from "./TemplatePicker";

// The code editor is large: only people who write custom HTML download it.
const HtmlSection = dynamic(() => import("./html/HtmlSection"), {
  ssr: false,
  loading: () => (
    <p className="text-xs text-muted-foreground">Loading the editor…</p>
  ),
});

export const IMAGE_MAX_BYTES = 1024 * 1024;

const TAP_OPTIONS = [
  { value: "none" as const, label: "Nothing" },
  ...IN_APP_ACTIONS.map((value) => ({ value, label: ACTION_LABELS[value] })),
];

interface Props {
  // The draft as the selected variant reads it: its own text, A's template and pictures.
  draft: InAppDraft;
  // What to show in the tiles: the chosen file while the server's address is not usable yet.
  images: InAppDraft["image"];
  set: (patch: Partial<InAppDraft>) => void;
  // Changes the HTML as it is when called, for uploads that finish late.
  setHtml: (update: (html: string) => string) => void;
  variant: VariantKey;
  // The variant bar, built from the campaign's own draft, not the variant's view of it.
  variantBar: ReactNode;
  // The template, and whether there is a question and of what kind, are fixed once launched.
  launched: boolean;
  uploading: InAppImageSlot | null;
  onImage: (slot: InAppImageSlot, file: File | null) => void;
  suggestions: InAppSuggestions;
  // The files a custom HTML message can use.
  media?: ReactNode;
  // Uploads a file for quick edit and returns its address; throws when it can't.
  uploadMedia?: (file: File) => Promise<string>;
  // Whether the custom HTML design window is open.
  onDesignChange?: (open: boolean) => void;
  // Switches to variant A, where the shared choices are made.
  onEditA?: () => void;
}

type TextKey = "title" | "message";

const counter = (n: number, max: number) => (
  <p className="text-right text-xs tabular-nums text-muted-foreground">
    {n} / {max}
  </p>
);

export default function MessageSection({
  draft,
  images,
  set,
  setHtml,
  variant,
  variantBar,
  launched,
  uploading,
  onImage,
  suggestions,
  media,
  uploadMedia,
  onDesignChange,
  onEditA,
}: Props) {
  const kind = TEMPLATES[draft.template];
  // B and C share A's question kind and choices.
  const shared = variant !== "a";
  // A message that fills the screen leaves nothing behind it to dim.
  const full = draft.template === "cover" || draft.template === "cover_image";
  const alert = draft.template === "alert";
  const title = useRef<HTMLInputElement>(null);
  const message = useRef<HTMLTextAreaElement>(null);
  const withEvent = draft.triggers.some((t) => t.type === "event");
  const question = draft.question;
  const choiceLock = shared ? (
    <LockedNotice
      title="Set on variant A"
      detail="Every variant offers the same buttons or question as A. Change it on A."
      action={onEditA && { label: "Go to variant A", onClick: onEditA }}
    />
  ) : launched ? (
    <LockedNotice
      title="Locked after launch"
      detail="What people can do can't change once the message is live."
    />
  ) : undefined;
  const unavailable = question
    ? Object.fromEntries(
        IN_APP_TEMPLATES.map((t) => [t, questionTemplateReason(t) ?? undefined])
      )
    : {};

  const setButton = (index: number, patch: Partial<InAppDraft["buttons"][0]>) =>
    set({
      buttons: draft.buttons.map((b, i) =>
        i === index ? { ...b, ...patch } : b
      ),
    });

  const insert = (key: TextKey, field: string) => {
    const el = key === "title" ? title.current : message.current;
    set({
      [key]: insertAt(
        draft[key],
        field,
        el?.selectionStart ?? null,
        el?.selectionEnd ?? null
      ),
    });
    el?.focus();
  };

  const textLabel = (key: TextKey, label: string, id: string) => (
    <div className="flex items-center justify-between">
      <Label htmlFor={id} className="text-[13px]">
        {label}
      </Label>
      <InsertField
        target={key}
        suggestions={suggestions}
        withEvent={withEvent}
        onInsert={(field) => insert(key, field)}
      />
    </div>
  );

  const template = (
    <div className="space-y-2">
      <p className="text-[13px] font-medium">Template</p>
      <TemplatePicker
        value={draft.template}
        disabled={launched}
        unavailable={unavailable}
        onChange={(template) => set({ template })}
      />
      {launched && (
        <p className="text-xs text-muted-foreground">
          The template cannot change after launch.
        </p>
      )}
      {kind.html && (
        <p className="text-xs text-muted-foreground">{HTML_TEMPLATE_NOTE}</p>
      )}
      {alert && alertLimitProblems(draft).length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sidebar-border bg-muted/40 p-3 text-xs">
          <span>
            Alerts are for short messages. For longer text, use Interstitial (a
            card in the middle).
          </span>
          {!launched && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => set({ template: "interstitial" })}
            >
              Switch to Interstitial
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (kind.html)
    return (
      <div className="space-y-6">
        {variantBar}
        {template}
        <HtmlSection
          // Each variant gets its own editor, and with it its own undo history.
          key={variant}
          variant={variant}
          draft={draft}
          set={set}
          setHtml={setHtml}
          suggestions={suggestions}
          media={media}
          upload={uploadMedia}
          onEditingChange={onDesignChange}
        />
      </div>
    );

  return (
    <div className="space-y-6">
      {variantBar}
      {template}

      {!kind.imageOnly && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            {textLabel("title", "Title", "in-app-title")}
            <Input
              id="in-app-title"
              ref={title}
              maxLength={256}
              value={draft.title}
              aria-invalid={alert && !!alertTitleProblem(draft.title)}
              onChange={(e) => set({ title: e.target.value })}
            />
            {alert && (
              <>
                <FieldError
                  message={alertTitleProblem(draft.title) ?? undefined}
                />
                {counter(charCount(draft.title), ALERT_LIMITS.title)}
              </>
            )}
          </div>
          <div className="space-y-1.5">
            {textLabel("message", "Message", "in-app-message")}
            <Textarea
              id="in-app-message"
              ref={message}
              maxLength={1024}
              rows={3}
              value={draft.message}
              aria-invalid={alert && !!alertMessageProblem(draft.message)}
              onChange={(e) => set({ message: e.target.value })}
            />
            {alert && (
              <>
                <FieldError
                  message={alertMessageProblem(draft.message) ?? undefined}
                />
                {counter(charCount(draft.message), ALERT_LIMITS.message)}
              </>
            )}
          </div>
        </div>
      )}

      {kind.image && variant !== "a" && (
        <p className="text-xs text-muted-foreground">
          Variants share the pictures of A.
        </p>
      )}
      {kind.image && variant === "a" && (
        <div className="space-y-2">
          <p className="text-[13px] font-medium">
            {kind.imageOnly ? "Image" : "Image (optional)"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["portrait", "landscape"] as const).map((slot) => (
              <ImageTile
                key={slot}
                slot={slot}
                url={images[slot]}
                busy={uploading === slot}
                onImage={onImage}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[13px] font-medium">What people can do</p>
        <div
          role="radiogroup"
          aria-label="What people can do"
          className="grid gap-2 sm:grid-cols-2"
        >
          <OptionCard
            selected={!question}
            title="Tap a button"
            hint="Up to two buttons, or a tap on the message"
            icon={<MousePointerClick className="size-4" />}
            locked={choiceLock}
            onSelect={() => question && set({ question: null })}
          />
          <OptionCard
            selected={!!question}
            title="Answer a question"
            hint="Stars, or a choice from a list"
            icon={<MessageCircleQuestion className="size-4" />}
            locked={choiceLock}
            onSelect={() =>
              !question && set({ question: blankQuestion("stars") })
            }
          />
        </div>
      </div>

      {question && (
        <QuestionEditor
          question={question}
          problem={questionTemplateProblem(draft)}
          launched={launched}
          shared={shared}
          onEditA={onEditA}
          onChange={(next) => set({ question: next })}
        />
      )}

      {!kind.imageOnly && !question && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium">Buttons</p>
            {draft.buttons.length < MAX_BUTTONS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  set({
                    buttons: [
                      ...draft.buttons,
                      {
                        id: nextButtonId(draft.buttons),
                        text: "",
                        action: { type: "close" },
                      },
                    ],
                  })
                }
              >
                <Plus className="size-3.5" />
                Add button
              </Button>
            )}
          </div>
          {draft.buttons.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Up to two. Without a button, people close the message with its
              close button.
            </p>
          )}
          {draft.buttons.map((button, index) => (
            <div
              // Variants share button ids; the variant in the key gives each its own uncontrolled data box.
              key={`${variant}-${button.id}`}
              className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-sidebar-border p-3"
            >
              <div className="space-y-2">
                <Input
                  aria-label={`Button ${index + 1} label`}
                  placeholder="Label"
                  maxLength={64}
                  value={button.text}
                  aria-invalid={
                    alert && !!alertButtonProblem(button.text, index)
                  }
                  onChange={(e) => setButton(index, { text: e.target.value })}
                />
                {alert && (
                  <>
                    <FieldError
                      message={
                        alertButtonProblem(button.text, index) ?? undefined
                      }
                    />
                    {counter(charCount(button.text), ALERT_LIMITS.button)}
                  </>
                )}
                <ActionEditor
                  label={`Button ${index + 1}`}
                  action={button.action}
                  onChange={(action) => setButton(index, { action })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove button ${index + 1}`}
                onClick={() =>
                  set({ buttons: draft.buttons.filter((_, i) => i !== index) })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {draft.template !== "alert" && <ColorsSection draft={draft} set={set} />}

      <div className="divide-y divide-sidebar-border rounded-lg border border-sidebar-border">
        {!question && (
          <div className="space-y-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[13px]">When the message itself is tapped</p>
                <p className="text-xs text-muted-foreground">
                  {kind.imageOnly
                    ? "An image has no buttons, so this is what it does."
                    : "Outside its buttons."}
                </p>
              </div>
              <Choice
                label="Tap action"
                className="w-56"
                value={draft.tapAction?.type ?? "none"}
                options={TAP_OPTIONS}
                onChange={(type) =>
                  set({
                    tapAction:
                      type === "none" ? null : { ...draft.tapAction, type },
                  })
                }
              />
            </div>
            {draft.tapAction &&
              ["open_url", "key_value"].includes(draft.tapAction.type) && (
                <ActionEditor
                  key={variant}
                  label="Tap"
                  action={draft.tapAction}
                  onChange={(tapAction) => set({ tapAction })}
                  typeless
                />
              )}
          </div>
        )}
        <label className="flex items-center justify-between gap-3 p-3 text-[13px]">
          <span>
            People can close it without answering
            <span className="block text-xs text-muted-foreground">
              {draft.dismissible
                ? "With the close button, a tap outside it, or a swipe."
                : question
                  ? "It stays until the question is answered."
                  : "It stays until a button or the message is tapped. For what must be answered, such as a required update."}
            </span>
          </span>
          <Switch
            checked={draft.dismissible}
            onCheckedChange={(dismissible) => set({ dismissible })}
          />
        </label>
        {draft.dismissible && (
          <label className="flex items-center justify-between gap-3 p-3 text-[13px]">
            Show a close button
            <Switch
              checked={draft.closeButton}
              onCheckedChange={(closeButton) => set({ closeButton })}
            />
          </label>
        )}
        {!kind.banner && !full && draft.template !== "alert" && (
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
