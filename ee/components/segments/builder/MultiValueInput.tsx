"use client";
import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { byteLength } from "@ee/lib/segments";
import { cn } from "@/lib/utils";

interface Props {
  values: string[];
  onChange: (values: string[]) => void;
  maxValues: number;
  maxBytes: number;
  placeholder?: string;
  ariaLabel: string;
  suggestions?: string[];
  className?: string;
}

const split = (text: string) =>
  text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

export default function MultiValueInput({
  values,
  onChange,
  maxValues,
  maxBytes,
  placeholder,
  ariaLabel,
  suggestions,
  className,
}: Props) {
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const listId = suggestions?.length
    ? `mvi-${ariaLabel.replace(/\s+/g, "-").toLowerCase()}`
    : undefined;

  const add = (incoming: string[]) => {
    const next = [...values];
    let dropped = 0;
    for (const v of incoming) {
      if (next.includes(v)) continue;
      if (next.length >= maxValues || byteLength(v) > maxBytes) {
        dropped += 1;
        continue;
      }
      next.push(v);
    }
    setNote(
      dropped
        ? `${dropped} value${dropped > 1 ? "s" : ""} skipped (limit ${maxValues} values of ${maxBytes} bytes)`
        : null
    );
    onChange(next);
  };
  const commit = () => {
    if (draft.trim()) add(split(draft));
    setDraft("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && values.length > 0)
      onChange(values.slice(0, -1));
  };
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (/[\n,]/.test(text)) {
      e.preventDefault();
      add(split(text));
    }
  };

  return (
    <div
      className={cn(
        "inline-flex min-w-[180px] max-w-full flex-col gap-1",
        className
      )}
    >
      <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-1.5 py-0.5 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex h-6 items-center gap-1 rounded bg-muted px-1.5 text-xs"
          >
            {v}
            <button
              type="button"
              aria-label={`Remove ${v}`}
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onChange(values.filter((x) => x !== v))}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          aria-label={ariaLabel}
          list={listId}
          className="h-6 min-w-20 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
          value={draft}
          placeholder={
            values.length === 0
              ? (placeholder ?? "Type and press Enter")
              : undefined
          }
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          onPaste={onPaste}
        />
        {listId && (
          <datalist id={listId}>
            {suggestions!.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
