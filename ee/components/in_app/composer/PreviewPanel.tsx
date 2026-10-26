"use client";
import { useState, type ReactNode } from "react";
import { Maximize2, Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { segmentClass } from "@/components/composer/Segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { highStars, lowStars, type InAppDraft } from "@ee/lib/inAppComposer";
import HtmlPreview from "./html/HtmlPreview";
import MessagePreview, {
  PREVIEW_DEVICES,
  previewSteps,
  type PreviewDevice,
  type PreviewStep,
} from "./MessagePreview";

const LABELS: Record<PreviewDevice, string> = {
  phone: "Phone",
  landscape: "Phone landscape",
  web: "Web page",
};

function DeviceToggle({
  device,
  onChange,
}: {
  device: PreviewDevice;
  onChange: (device: PreviewDevice) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Preview on"
      className="inline-flex rounded-lg border border-sidebar-border bg-background p-0.5"
    >
      {PREVIEW_DEVICES.map((item) => (
        <button
          key={item}
          type="button"
          role="radio"
          aria-checked={device === item}
          aria-label={LABELS[item]}
          title={LABELS[item]}
          onClick={() => onChange(item)}
          className={cn(
            "flex h-7 w-9 items-center justify-center rounded-md transition-colors",
            device === item
              ? "bg-accent text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {item === "web" ? (
            <Monitor className="size-4" />
          ) : (
            <Smartphone
              className={cn("size-4", item === "landscape" && "rotate-90")}
            />
          )}
        </button>
      ))}
    </div>
  );
}

function StepToggle({
  draft,
  step,
  onChange,
}: {
  draft: Draft;
  step: PreviewStep;
  onChange: (step: PreviewStep) => void;
}) {
  const steps = previewSteps(draft.question);
  const both = steps.includes("low") && steps.includes("high");
  const commenting = step === "low" || step === "high";
  const shown = [
    { step: "question" as const, label: "Question" },
    {
      step: steps.includes("low") ? ("low" as const) : ("high" as const),
      label: "Comment",
    },
    { step: "thanks" as const, label: "Thanks" },
  ].filter((item) => steps.includes(item.step));
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Preview step"
        className="inline-flex rounded-lg border border-sidebar-border bg-background p-0.5"
      >
        {shown.map((item) => {
          const on =
            item.step === step || (item.label === "Comment" && commenting);
          return (
            <button
              key={item.label}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => !on && onChange(item.step)}
              className={segmentClass(on)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {both && commenting && (
        <div
          role="radiogroup"
          aria-label="Comment for"
          className="inline-flex rounded-lg border border-sidebar-border bg-background p-0.5"
        >
          {(["low", "high"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={step === item}
              onClick={() => onChange(item)}
              className={segmentClass(step === item)}
            >
              {item === "low"
                ? lowStars(draft.question!)
                : highStars(draft.question!)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// The panel while the message it shows is on its way.
export function PreviewSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between">
        <Skeleton className="h-8 w-[114px] rounded-lg" />
        <Skeleton className="size-8" />
      </div>
      <Skeleton className="h-[390px] w-[186px] rounded-[22px]" />
      <Skeleton className="my-0.5 h-3 w-48" />
    </div>
  );
}

type Draft = Parameters<typeof MessagePreview>[0]["draft"] &
  Pick<InAppDraft, "html" | "layout">;

export default function PreviewPanel({
  draft,
  header,
}: {
  draft: Draft;
  // Above the device toggle: the report's variant pills.
  header?: ReactNode;
}) {
  const [device, setDevice] = useState<PreviewDevice>("phone");
  const [large, setLarge] = useState(false);
  const [chosen, setStep] = useState<PreviewStep>("question");
  const steps = previewSteps(draft.question);
  // A step that was switched off in the editor falls back to the question.
  const step = steps.includes(chosen) ? chosen : "question";
  if (draft.template === "html")
    return (
      <div className="flex flex-col items-center gap-3">
        {header && <div className="w-full">{header}</div>}
        <HtmlPreview
          html={draft.html}
          layout={draft.layout}
          dismissible={draft.dismissible}
          backdrop={draft.backdrop}
        />
      </div>
    );
  return (
    <div className="flex flex-col items-center gap-3">
      {header && <div className="w-full">{header}</div>}
      <div className="flex w-full items-center justify-between">
        <DeviceToggle device={device} onChange={setDevice} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Open a larger preview"
          onClick={() => setLarge(true)}
        >
          <Maximize2 className="size-4" />
        </Button>
      </div>
      {steps.length > 1 && (
        <StepToggle draft={draft} step={step} onChange={setStep} />
      )}
      <MessagePreview
        draft={draft}
        step={step}
        device={device}
        maxWidth={270}
        maxHeight={380}
      />
      <p className="text-center text-xs text-muted-foreground">
        {LABELS[device]}. Fonts are each platform&apos;s own.
      </p>
      <Dialog open={large} onOpenChange={setLarge}>
        <DialogContent className="flex max-h-[92vh] flex-col items-center gap-4 sm:max-w-[min(1000px,94vw)]">
          <DialogHeader className="w-full flex-row items-center justify-between gap-4 space-y-0 pr-8">
            <div>
              <DialogTitle className="text-[15px]">Preview</DialogTitle>
              <DialogDescription>{LABELS[device]}</DialogDescription>
            </div>
            <DeviceToggle device={device} onChange={setDevice} />
          </DialogHeader>
          {large && (
            <MessagePreview
              draft={draft}
              step={step}
              device={device}
              maxWidth={920}
              maxHeight={620}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
