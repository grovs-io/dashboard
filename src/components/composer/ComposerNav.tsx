"use client";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComposerStepState = "todo" | "done" | "wrong";

// The numbered sections down the left of a composer.
export default function ComposerNav<T extends string>({
  label,
  sections,
  labels,
  current,
  onSelect,
  stateOf,
}: {
  label: string;
  sections: readonly T[];
  labels: Record<T, string>;
  current: T;
  onSelect: (section: T) => void;
  stateOf: (section: T, index: number) => ComposerStepState;
}) {
  return (
    <nav
      aria-label={label}
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-sidebar-border bg-sidebar p-3 md:w-[230px] md:flex-col md:gap-1 md:border-b-0 md:border-r"
    >
      {sections.map((item, i) => {
        const active = item === current;
        const state = stateOf(item, i);
        return (
          <button
            key={item}
            type="button"
            aria-current={active ? "step" : undefined}
            data-state={state}
            onClick={() => onSelect(item)}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
              active
                ? "bg-background shadow-sm ring-1 ring-sidebar-border dark:bg-muted"
                : "hover:bg-muted/60"
            )}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                state === "wrong"
                  ? "bg-destructive/10 text-destructive"
                  : state === "done"
                    ? "bg-valid-green-light text-valid-green"
                    : active
                      ? "bg-primary text-white dark:bg-primary/20 dark:text-primary"
                      : "border border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {state === "done" ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "text-[13px] font-medium",
                active ? "text-foreground" : "text-sidebar-foreground"
              )}
            >
              {labels[item]}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
