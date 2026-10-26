"use client";
import { useState } from "react";
import { Check, ChevronsUpDown, Code } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { TEMPLATES } from "@ee/lib/inApp";
import { IN_APP_TEMPLATES, type InAppTemplate } from "@ee/types/inApp";

const bar = "rounded-full bg-[#9AA6B5]";

// A drawing of where the message sits on the screen and what it holds.
export function TemplateThumb({ template }: { template: InAppTemplate }) {
  const kind = TEMPLATES[template];
  const full = template === "cover" || template === "cover_image";
  const half = template.startsWith("half_");
  const picture = (className: string) => (
    <div className={cn("bg-[#7FB2FF]", className)} />
  );
  if (kind.html)
    return (
      <div
        aria-hidden="true"
        className="flex h-[60px] w-[34px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] border-[#1B1F27] bg-[#E9EDF2] text-[#2A86FF]"
      >
        <Code className="size-4" />
      </div>
    );
  return (
    <div
      aria-hidden="true"
      className="relative h-[60px] w-[34px] shrink-0 overflow-hidden rounded-[6px] border-[1.5px] border-[#1B1F27] bg-[#E9EDF2]"
    >
      {!kind.banner && !full && (
        <div className="absolute inset-0 bg-black/25" />
      )}
      {kind.banner ? (
        <div
          className={cn(
            "absolute inset-x-0 flex items-center gap-[2px] bg-white p-[3px] shadow",
            template === "header" ? "top-0" : "bottom-0"
          )}
        >
          {picture("size-[6px] shrink-0 rounded-[1px]")}
          <div className="flex-1 space-y-[2px]">
            <div className={cn(bar, "h-[2px] w-4/5 bg-[#5B6675]")} />
            <div className={cn(bar, "h-[2px] w-full")} />
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "absolute flex flex-col overflow-hidden bg-white shadow",
            full
              ? "inset-0"
              : "inset-x-[4px] top-1/2 -translate-y-1/2 rounded-[3px]"
          )}
        >
          {template !== "alert" &&
            picture(
              cn(
                "w-full",
                full
                  ? "min-h-0 flex-1"
                  : kind.imageOnly
                    ? half
                      ? "h-[18px]"
                      : "h-[28px]"
                    : half
                      ? "h-[10px]"
                      : "h-[16px]"
              )
            )}
          {!kind.imageOnly && (
            <div className="space-y-[2px] p-[3px]">
              <div className={cn(bar, "h-[2px] w-3/5 bg-[#5B6675]")} />
              <div className={cn(bar, "h-[2px] w-full")} />
              <div className="h-[4px] w-2/5 rounded-[1px] bg-[#2A86FF]" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Option({
  template,
  reason,
}: {
  template: InAppTemplate;
  reason?: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-3 text-left">
      <TemplateThumb template={template} />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium">
          {TEMPLATES[template].label}
        </span>
        <span className="block text-xs text-muted-foreground">
          {reason ?? TEMPLATES[template].hint}
        </span>
      </span>
    </span>
  );
}

// A select whose options show what each template looks like.
export default function TemplatePicker({
  value,
  disabled,
  unavailable = {},
  onChange,
}: {
  value: InAppTemplate;
  disabled?: boolean;
  // Templates that cannot be chosen now, each with its reason.
  unavailable?: Partial<Record<InAppTemplate, string>>;
  onChange: (template: InAppTemplate) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    // Modal, so the dialog's scroll lock doesn't swallow wheel scrolling in the list.
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label="Template"
          aria-expanded={open}
          aria-controls="in-app-templates"
          disabled={disabled}
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-input bg-transparent p-2.5 shadow-xs transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Option template={value} />
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        id="in-app-templates"
        align="start"
        className="max-h-[min(460px,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] overflow-y-auto p-1"
      >
        <div role="listbox" aria-label="Templates">
          {IN_APP_TEMPLATES.map((template) => (
            <button
              key={template}
              type="button"
              role="option"
              aria-selected={template === value}
              disabled={!!unavailable[template]}
              onClick={() => {
                onChange(template);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-md p-2 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent",
                template === value && "bg-accent"
              )}
            >
              <Option template={template} reason={unavailable[template]} />
              {template === value && (
                <Check className="size-4 shrink-0 text-primary" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
