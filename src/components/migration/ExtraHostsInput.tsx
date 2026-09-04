"use client";

import { useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isValidExtraHost } from "./migrationPayload";

interface ExtraHostsInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Adding this host is rejected with an inline error. */
  mainHost?: string;
  /** Server-side error rendered below the field. */
  error?: string | null;
  disabled?: boolean;
  inputId?: string;
  placeholder?: string;
}

const ExtraHostsInput = ({
  value,
  onChange,
  mainHost,
  error,
  disabled = false,
  inputId = "extra-hosts-input",
  placeholder = "xyz-alternate.app.link",
}: ExtraHostsInputProps) => {
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

  const tryCommit = (raw: string) => {
    const host = raw.trim().toLowerCase();
    if (!host) return;
    if (mainHost && host === mainHost.trim().toLowerCase()) {
      setDraftError("That's the main domain — no need to add it again");
      return;
    }
    if (value.includes(host)) {
      setDraftError("Already added");
      return;
    }
    if (!isValidExtraHost(host)) {
      setDraftError(
        "Enter a valid bare hostname (e.g. xyz-alternate.app.link)"
      );
      return;
    }
    onChange([...value, host]);
    setDraft("");
    setDraftError(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      tryCommit(draft);
      return;
    }
    if (event.key === "Backspace" && draft.length === 0 && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value.toLowerCase();
    if (next.endsWith(",")) {
      setDraft(next.slice(0, -1));
      tryCommit(next.slice(0, -1));
      return;
    }
    setDraft(next);
    if (draftError) setDraftError(null);
  };

  const visibleError = draftError ?? error ?? null;

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((host) => (
            <span
              key={host}
              className="inline-flex items-center gap-1 rounded-md border border-sidebar-border bg-secondary px-2 py-1 font-mono text-xs"
            >
              {host}
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remove ${host}`}
                  onClick={() => onChange(value.filter((h) => h !== host))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <Input
        id={inputId}
        type="text"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={placeholder}
        value={draft}
        disabled={disabled}
        aria-invalid={visibleError ? true : undefined}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => tryCommit(draft)}
        className={cn(visibleError && "border-destructive")}
      />
      {visibleError && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {visibleError}
        </p>
      )}
    </div>
  );
};

export default ExtraHostsInput;
