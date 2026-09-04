"use client";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type FieldErrorProps = {
  /** The error message to show. When empty/undefined, nothing renders. */
  message?: string;
  className?: string;
};

/**
 * Inline field-level error: a small alert icon next to `text-destructive` copy.
 * Pairs with an `aria-invalid` input so the field border and message stay in
 * sync. Renders nothing when there is no message, so it can be dropped under any
 * input unconditionally.
 */
export function FieldError({ message, className }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={cn(
        "flex items-start gap-1.5 text-xs font-medium text-destructive",
        className
      )}
    >
      <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}
