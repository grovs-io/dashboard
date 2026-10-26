"use client";
import { cn } from "@/lib/utils";

export const segmentClass = (on: boolean) =>
  cn(
    "h-7 rounded-md px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
    on
      ? "bg-accent text-primary"
      : "text-muted-foreground enabled:hover:text-foreground"
  );

// The composers' text segmented control, as a radio group.
export default function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean; title?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-lg border border-sidebar-border bg-background p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={segmentClass(value === o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
