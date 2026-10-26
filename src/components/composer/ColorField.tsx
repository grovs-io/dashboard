"use client";
import { useState } from "react";
import { Check, Pipette } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { isColor, isHexColor } from "@/lib/color";

export const PALETTE = [
  "#FFFFFF",
  "#F3F4F6",
  "#111827",
  "#000000",
  "#2A86FF",
  "#1E6EDC",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#8B5CF6",
  "#FFE08A",
];

const same = (a: string | undefined, b: string) =>
  (a ?? "").toUpperCase() === b.toUpperCase();

// One row: what the colour is for, and the colour. A click opens the choices.
export default function ColorField({
  label,
  value,
  fallback,
  onChange,
  automatic = true,
  hexOnly = false,
}: {
  label: string;
  value: string | undefined;
  // What a device uses when no colour is chosen.
  fallback: string;
  onChange: (value: string | undefined) => void;
  // Without it a colour is always chosen, as in custom HTML.
  automatic?: boolean;
  // Rejects #RRGGBBAA; smart banners match the backend, which has no alpha.
  hexOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const valid = hexOnly ? isHexColor : isColor;
  const wrong = typed !== "" && !valid(typed);
  return (
    <Popover
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setTyped("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${value ?? "automatic"}`}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/60"
        >
          <span
            className="size-5 shrink-0 rounded-full border border-black/15"
            style={{ backgroundColor: value ?? fallback }}
          />
          <span className="min-w-0 flex-1 truncate text-[13px]">{label}</span>
          <span
            className={cn(
              "text-xs",
              value ? "font-mono" : "text-muted-foreground"
            )}
          >
            {value ?? "Automatic"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 space-y-3 p-3">
        <div
          role="listbox"
          aria-label={`${label} choices`}
          className="grid grid-cols-6 gap-1.5"
        >
          {PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              role="option"
              aria-selected={same(value, color)}
              aria-label={color}
              onClick={() => {
                onChange(color);
                setOpen(false);
              }}
              className="flex size-7 items-center justify-center rounded-full border border-black/15 transition-transform hover:scale-110"
              style={{ backgroundColor: color }}
            >
              {same(value, color) && (
                <Check
                  className={cn(
                    "size-3.5",
                    ["#FFFFFF", "#F3F4F6", "#FFE08A"].includes(color)
                      ? "text-black"
                      : "text-white"
                  )}
                />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Input
            aria-label={`${label} code`}
            placeholder={value ?? "#RRGGBB"}
            maxLength={hexOnly ? 7 : 9}
            aria-invalid={wrong}
            className="h-8 min-w-0 font-mono text-xs"
            value={typed}
            onChange={(e) => {
              const next = e.target.value.trim();
              setTyped(next);
              if (valid(next)) onChange(next.toUpperCase());
            }}
          />
          <span
            title="More colours"
            className="relative flex size-8 shrink-0 items-center justify-center rounded-md border border-sidebar-border text-muted-foreground hover:text-foreground"
          >
            <Pipette className="size-3.5" />
            <input
              type="color"
              aria-label={`${label}, more colours`}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              value={(value ?? fallback).slice(0, 7)}
              onChange={(e) => onChange(e.target.value.toUpperCase())}
            />
          </span>
        </div>
        {automatic && (
          <button
            type="button"
            disabled={!value}
            className="w-full rounded-md py-1.5 text-xs font-medium text-primary hover:bg-accent disabled:text-muted-foreground disabled:hover:bg-transparent"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
          >
            {value
              ? "Back to automatic"
              : "Automatic: chosen to suit the background"}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
