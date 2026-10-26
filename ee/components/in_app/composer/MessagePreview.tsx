"use client";
import { Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import DeviceFrame, {
  LANDSCAPE_SAFE,
  PREVIEW_DEVICES,
  PreviewPage,
  SCREENS,
  previewScale,
  type PreviewDevice,
} from "@/components/composer/DeviceFrame";
import { TEMPLATES } from "@ee/lib/inApp";
import {
  isDark,
  type DraftQuestion,
  type InAppDraft,
} from "@ee/lib/inAppComposer";

const FIELD =
  /\{\{\s*(?:user|event)\.([A-Za-z0-9_]+)\s*(?:\|\s*default:\s*"([^"{}]*)"\s*)?\}\}/g;

// Shows the fallback where a device would put the person's own value.
export const previewText = (text: string) =>
  text.replace(FIELD, (_all, key: string, fallback?: string) =>
    fallback !== undefined ? fallback : `[${key}]`
  );

export { PREVIEW_DEVICES, previewScale, type PreviewDevice };

const WIDTHS: Partial<Record<InAppDraft["template"], number>> = {
  interstitial: 640,
  interstitial_image: 640,
  half_interstitial: 420,
  half_interstitial_image: 420,
  alert: 340,
};

// What a person sees in turn: the question, then a comment box, then the thanks.
export type PreviewStep = "question" | "low" | "high" | "thanks";

export function previewSteps(question: DraftQuestion | null): PreviewStep[] {
  if (!question) return [];
  return [
    "question" as const,
    ...(question.low?.trim() ? ["low" as const] : []),
    ...(question.type === "stars" && question.high?.trim()
      ? ["high" as const]
      : []),
    ...(question.thanks.trim() ? ["thanks" as const] : []),
  ];
}

interface Props {
  draft: Pick<
    InAppDraft,
    | "template"
    | "title"
    | "message"
    | "image"
    | "colors"
    | "closeButton"
    | "dismissible"
    | "backdrop"
    | "buttons"
    | "question"
  >;
  // Which part of a question to draw.
  step?: PreviewStep;
  device?: PreviewDevice;
  maxWidth?: number;
  maxHeight?: number;
}

export default function MessagePreview({
  draft,
  step = "question",
  device = "phone",
  maxWidth = 230,
  maxHeight = 440,
}: Props) {
  const kind = TEMPLATES[draft.template];
  const screen = SCREENS[device];
  const narrow = screen.width <= 600;
  const wide = screen.width > screen.height;
  // Content keeps out of the island side and its mirror, as iOS's safe area does.
  const side = device === "landscape" ? LANDSCAPE_SAFE.side : 0;
  const image = kind.image
    ? ((wide ? draft.image.landscape : draft.image.portrait) ??
      draft.image.portrait ??
      draft.image.landscape)
    : null;
  const full = draft.template === "cover" || draft.template === "cover_image";
  const half = draft.template.startsWith("half_");
  const dim = !kind.banner && !full && draft.backdrop === "dim";
  const closable = draft.dismissible && draft.closeButton;
  const clear = closable && !image && !kind.imageOnly;
  // As on a device: text and the close button turn light on a dark card.
  const dark = !!draft.colors.background && isDark(draft.colors.background);

  const question = kind.imageOnly ? null : draft.question;
  const soft = dark ? "bg-white/[0.16] text-white" : "bg-[#E9EEF5] text-[#111]";
  // In a banner the question, the comment box and the thanks run full width under the text.
  const under = cn(
    kind.banner
      ? narrow || question
        ? "w-full basis-full"
        : "shrink-0"
      : "shrink-0 px-5 pb-5"
  );
  const answer = question && step === "question" && (
    <div className={under}>
      {question.type === "stars" && (
        <div
          className={cn(
            "flex gap-2",
            kind.banner ? "justify-start" : "justify-center"
          )}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              aria-hidden="true"
              className={cn(
                "fill-current",
                kind.banner ? "size-8" : "size-10",
                dark ? "text-white/30" : "text-[#D5DBE3]"
              )}
            />
          ))}
        </div>
      )}
      {question.type === "choice" && (
        <div className="flex flex-col gap-2">
          {question.options.map((option, i) => (
            <span
              key={option.id}
              className={cn(
                "truncate rounded-[10px] px-4 text-center font-semibold",
                kind.banner ? "py-2 text-[13px]" : "py-3 text-[15px]",
                soft
              )}
            >
              {option.text || `Choice ${i + 1}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
  const comment = question && (step === "low" || step === "high") && (
    <div className={cn("flex flex-col gap-2.5", under)}>
      <span
        className={cn(
          "rounded-[10px] border px-3 pt-2.5 text-[15px]",
          kind.banner ? "h-16" : "h-24",
          dark
            ? "border-white/25 text-white/60"
            : "border-[#D5DBE3] text-[#8A94A3]"
        )}
      >
        Your answer
      </span>
      <div className="flex gap-2.5">
        <span className="flex-1 rounded-[10px] bg-[#2A86FF] px-4 py-3 text-center text-[15px] font-semibold text-white">
          Send
        </span>
        <span
          className={cn(
            "flex-1 rounded-[10px] px-4 py-3 text-center text-[15px] font-semibold",
            dark ? "bg-white/15 text-white" : "bg-[#E9EEF5] text-[#111111]"
          )}
        >
          Skip
        </span>
      </div>
    </div>
  );
  // The comment and the thanks take the place of the title and the message.
  const words =
    question && step !== "question"
      ? step === "thanks"
        ? question.thanks
        : question[step]
      : null;

  const buttons = !kind.imageOnly && !question && draft.buttons.length > 0 && (
    <div
      className={cn(
        "flex gap-2.5",
        kind.banner
          ? narrow
            ? "w-full basis-full"
            : "shrink-0"
          : "shrink-0 px-5 pb-5"
      )}
    >
      {draft.buttons.map((button, i) => (
        <span
          key={button.id}
          className={cn(
            "min-w-0 truncate rounded-[10px] text-center font-semibold",
            kind.banner
              ? "px-3 py-2 text-[13px]"
              : "flex-1 px-4 py-3 text-[15px]",
            kind.banner && narrow && "flex-1",
            !button.colors?.background &&
              (i === 0 ? "bg-[#2A86FF]" : "bg-[#E9EEF5]"),
            !button.colors?.text && (i === 0 ? "text-white" : "text-[#111]")
          )}
          style={{
            backgroundColor: button.colors?.background,
            color: button.colors?.text,
          }}
        >
          {previewText(button.text) || "Button"}
        </span>
      ))}
    </div>
  );

  const text = !kind.imageOnly && (
    <div
      className={cn(
        "flex min-w-0 flex-col [overflow-wrap:anywhere]",
        kind.banner ? "flex-1 gap-0.5" : "shrink-0 gap-2 p-5",
        (!kind.banner && clear) || (kind.banner && question)
          ? "[&>*:first-child]:pr-7"
          : undefined
      )}
    >
      {words !== null && (
        <p
          className={cn(
            "font-bold leading-tight",
            dark ? "text-white" : "text-[#111]",
            kind.banner ? "text-[15px]" : "text-[20px]",
            step === "thanks" && !kind.banner && "py-4 text-center"
          )}
          style={{ color: draft.colors.title }}
        >
          {words}
        </p>
      )}
      {words === null && draft.title && (
        <p
          className={cn(
            "font-bold leading-tight",
            dark ? "text-white" : "text-[#111]",
            kind.banner ? "text-[15px]" : "text-[20px]"
          )}
          style={{ color: draft.colors.title }}
        >
          {previewText(draft.title)}
        </p>
      )}
      {words === null && draft.message && (
        <p
          className={cn(
            "whitespace-pre-line leading-[1.45]",
            dark ? "text-white" : "text-[#333]",
            kind.banner ? "text-[13px]" : "text-[15px]"
          )}
          style={{ color: draft.colors.message }}
        >
          {previewText(draft.message)}
        </p>
      )}
      {words === null && !draft.title && !draft.message && (
        <p className="text-[15px] text-[#888]">Your message</p>
      )}
    </div>
  );

  const closeButton = (className: string) => (
    <span
      className={cn(
        "absolute right-3 flex size-7 items-center justify-center rounded-full",
        image && !kind.banner
          ? "bg-black/45 text-white"
          : dark
            ? "bg-white/[0.16] text-white"
            : "bg-black/[0.06] text-[#555]",
        className
      )}
    >
      <X className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
    </span>
  );
  // Level with the first line of text when no picture sits under it, as on a device.
  const close =
    closable &&
    closeButton(
      cn(clear ? "top-[18px]" : "top-3", full && side && "right-[71px]")
    );

  const picture = (className: string) =>
    image ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" className={cn("object-cover", className)} />
    ) : kind.imageOnly ? (
      <div
        className={cn(
          "flex items-center justify-center bg-[#DDE3EA] text-[15px] text-[#667]",
          className
        )}
      >
        Your image
      </div>
    ) : null;

  const card = kind.banner ? (
    <div
      data-testid="in-app-preview-card"
      className={cn(
        "absolute inset-x-0 flex items-center gap-3 bg-white py-3 pl-3 shadow-[0_2px_16px_rgba(0,0,0,0.2)]",
        // A banner with a question is several rows tall: its close button sits at the top, and the rows run full width.
        question ? "pr-3" : "pr-11",
        (narrow || question) && "flex-wrap",
        draft.template === "header" ? "top-0" : "bottom-0",
        device !== "web" &&
          (draft.template === "header" ? device === "phone" && "pt-14" : "pb-8")
      )}
      style={{
        backgroundColor: draft.colors.background,
        paddingLeft: side ? side + 12 : undefined,
        paddingRight: side ? side + (question ? 12 : 44) : undefined,
      }}
    >
      {picture("size-12 shrink-0 rounded-lg")}
      {text}
      {buttons}
      {answer}
      {comment}
      {closable &&
        closeButton(
          cn(
            question
              ? device === "phone" && draft.template === "header"
                ? "top-[62px]"
                : "top-2.5"
              : device === "phone" && draft.template === "header"
                ? "top-[calc(50%+22px)] -translate-y-1/2"
                : device !== "web" && draft.template === "footer"
                  ? "top-[calc(50%-10px)] -translate-y-1/2"
                  : "top-1/2 -translate-y-1/2",
            side && "right-[71px]"
          )
        )}
    </div>
  ) : (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={
        side && !full
          ? { left: side, right: side, bottom: LANDSCAPE_SAFE.bottom }
          : undefined
      }
    >
      <div
        data-testid="in-app-preview-card"
        className={cn(
          "relative flex flex-col overflow-hidden bg-white",
          full
            ? "size-full"
            : "max-h-[92%] max-w-[92%] rounded-[14px] shadow-[0_12px_40px_rgba(0,0,0,0.3)]"
        )}
        style={{
          backgroundColor: draft.colors.background,
          width: full ? undefined : WIDTHS[draft.template],
          // A full-screen picture runs edge to edge; text stays in the safe area.
          ...(full &&
            side &&
            !(draft.template === "cover_image" && image) && {
              paddingLeft: side,
              paddingRight: side,
              paddingBottom: LANDSCAPE_SAFE.bottom,
            }),
        }}
      >
        {picture(
          cn(
            "w-full min-h-0",
            full || kind.imageOnly ? "flex-1" : "shrink",
            !full && (half ? "aspect-[13/10]" : "aspect-video")
          )
        )}
        {text}
        {buttons}
        {answer}
        {comment}
        {close}
      </div>
    </div>
  );

  return (
    <DeviceFrame
      device={device}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      label={`Message preview, ${device}`}
    >
      <PreviewPage device={device} />
      {dim && <div className="absolute inset-0 bg-black/45" />}
      {card}
    </DeviceFrame>
  );
}
