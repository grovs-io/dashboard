"use client";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PUSH_SECTIONS,
  SECTION_LABELS,
  type PushSection,
} from "@ee/lib/pushComposer";

interface Props {
  section: PushSection;
  done: Record<PushSection, boolean>;
  onSelect: (section: PushSection) => void;
}

export default function SectionNav({ section, done, onSelect }: Props) {
  return (
    <nav
      aria-label="Campaign sections"
      className="flex gap-1 overflow-x-auto md:flex-col md:gap-1 md:overflow-visible"
    >
      {PUSH_SECTIONS.map((item, index) => {
        const isActive = section === item;
        const isDone = done[item];
        return (
          <button
            key={item}
            type="button"
            aria-current={isActive ? "step" : undefined}
            onClick={() => onSelect(item)}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
              isActive
                ? "bg-background shadow-sm ring-1 ring-sidebar-border dark:bg-muted"
                : "hover:bg-muted/60"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                isDone
                  ? "bg-valid-green-light text-valid-green"
                  : isActive
                    ? "bg-primary text-white dark:bg-primary/20 dark:text-primary"
                    : "border border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span
              className={cn(
                "text-[13px] font-medium",
                isActive ? "text-foreground" : "text-sidebar-foreground"
              )}
            >
              {SECTION_LABELS[item]}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
