"use client";
import { useEffect, useMemo } from "react";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

type PasswordChecklistProps = {
  password: string;
  passwordConfirm: string;
  /** Minimum length for the "at least N characters" rule. Defaults to 8. */
  minLength?: number;
  /** Fires whenever the overall validity (all rules met) changes. */
  onValidityChange?: (valid: boolean) => void;
  className?: string;
};

// Mirrors the rule set previously enforced by `react-password-checklist` so the
// validation stays identical — only the presentation is now ours.
const SPECIAL_CHAR = /[~`!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

/**
 * Password requirements checklist styled with the app's own tokens: met rules
 * turn `valid-green` with a check, pending rules stay muted with an open circle.
 * Keeps typography in sync with `FieldError` (text-xs) so the sign-up form reads
 * as one consistent unit rather than a bolted-on library widget.
 */
export function PasswordChecklist({
  password,
  passwordConfirm,
  minLength = 8,
  onValidityChange,
  className,
}: PasswordChecklistProps) {
  const rules = useMemo(
    () => [
      {
        label: `At least ${minLength} characters`,
        met: password.length >= minLength,
      },
      { label: "One special character", met: SPECIAL_CHAR.test(password) },
      { label: "One capital letter", met: /[A-Z]/.test(password) },
      { label: "One lowercase letter", met: /[a-z]/.test(password) },
      { label: "One number", met: /[0-9]/.test(password) },
      {
        label: "Passwords match",
        met: password.length > 0 && password === passwordConfirm,
      },
    ],
    [password, passwordConfirm, minLength]
  );

  const allValid = rules.every((rule) => rule.met);

  useEffect(() => {
    onValidityChange?.(allValid);
  }, [allValid, onValidityChange]);

  return (
    <ul
      data-testid="password-checklist"
      className={cn("grid gap-1.5", className)}
    >
      {rules.map((rule) => (
        <li
          key={rule.label}
          className={cn(
            "flex items-center gap-2 text-xs transition-colors",
            rule.met ? "font-medium text-valid-green" : "text-muted-foreground"
          )}
        >
          {rule.met ? (
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Circle
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40"
              aria-hidden="true"
            />
          )}
          <span>{rule.label}</span>
        </li>
      ))}
    </ul>
  );
}
