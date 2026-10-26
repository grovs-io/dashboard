"use client";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// One of a few exclusive choices, shown as a card like the rest of the app's pickers.
export default function OptionCard({
  selected,
  disabled,
  // Why it is disabled, shown on hover.
  reason,
  title,
  hint,
  icon,
  onSelect,
  children,
  className,
  multiple = false,
  locked,
}: {
  selected: boolean;
  disabled?: boolean;
  reason?: string;
  title: string;
  hint?: string;
  icon?: ReactNode;
  onSelect: () => void;
  children?: ReactNode;
  className?: string;
  // One of several that can be on together, so a checkbox rather than a radio.
  multiple?: boolean;
  // Can't change here: looks normal, and a click explains why instead of selecting.
  locked?: ReactNode;
}) {
  const card = (
    <button
      type="button"
      role={multiple ? "checkbox" : "radio"}
      aria-checked={selected}
      aria-disabled={locked ? true : undefined}
      disabled={disabled}
      title={reason}
      onClick={locked ? undefined : onSelect}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-primary bg-accent ring-1 ring-primary"
          : "border-sidebar-border hover:bg-muted/60",
        locked && "relative",
        // The chosen one stays readable while locked; only the others dim.
        disabled && "cursor-not-allowed",
        disabled && !selected && "opacity-60",
        className
      )}
    >
      {children}
      {locked && !selected && (
        <Lock className="absolute top-3 right-3 size-3.5 text-muted-foreground" />
      )}
      <span className="flex items-start gap-2">
        {icon && (
          <span
            className={cn(
              "mt-0.5 shrink-0",
              selected ? "text-primary" : "text-muted-foreground"
            )}
          >
            {icon}
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-[13px] font-medium leading-tight">
            {title}
          </span>
          {hint && (
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
              {hint}
            </span>
          )}
        </span>
      </span>
    </button>
  );
  if (!locked || selected) return card;
  return (
    <Popover>
      <PopoverTrigger asChild>{card}</PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        {locked}
      </PopoverContent>
    </Popover>
  );
}
