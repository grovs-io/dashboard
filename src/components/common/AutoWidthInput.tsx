"use client";

import { cn } from "@/lib/utils";

/** Input as wide as its text, so a fixed suffix (".sqd.link") sits right after it; dashed underline marks it editable. */
export function AutoWidthInput({
  value,
  placeholder,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "size"> & { value: string }) {
  return (
    <span className="inline-grid min-w-[2ch]">
      {/* The hidden copy sizes the input in every browser. */}
      <span
        aria-hidden
        className={cn(
          "invisible col-start-1 row-start-1 whitespace-pre",
          className
        )}
      >
        {value || placeholder || " "}
      </span>
      <input
        {...props}
        value={value}
        placeholder={placeholder}
        size={1}
        spellCheck={false}
        autoCapitalize="off"
        className={cn(
          "col-start-1 row-start-1 w-full min-w-0 border-b border-dashed border-muted-foreground/50 bg-transparent outline-none transition-colors placeholder:text-muted-foreground/60 hover:border-foreground/60 focus:border-chart-users [field-sizing:content]",
          className
        )}
      />
    </span>
  );
}
