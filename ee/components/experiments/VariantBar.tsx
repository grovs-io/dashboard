"use client";
import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VariantKey } from "@ee/lib/inAppComposer";
import { VARIANT_IDS, type VariantId } from "@ee/types/experiment";

const TITLE_CHARS = 18;

export interface VariantPill {
  id: VariantKey;
  title: string;
}

// The "Variants" field above a message editor: which version is edited and previewed.
// Add and remove are given while a draft; after launch the pills only switch.
export default function VariantBar({
  variants,
  selected,
  onSelect,
  onAdd,
  onRemove,
  removeDisabled = false,
  children,
  compact = false,
}: {
  variants: VariantPill[];
  selected: VariantKey;
  onSelect: (variant: VariantKey) => void;
  onAdd?: () => void;
  onRemove?: (variant: VariantId) => void;
  removeDisabled?: boolean;
  // Shown under the row once there is more than one version.
  children?: ReactNode;
  // Pills only, for a report: no label, no explanation.
  compact?: boolean;
}) {
  const short = (title: string) => {
    const text = title.trim();
    if (!text) return "Untitled";
    return text.length > TITLE_CHARS ? `${text.slice(0, TITLE_CHARS)}…` : text;
  };
  const removable = onRemove && selected !== "a";
  return (
    <div className="space-y-2">
      {!compact && (
        <div>
          <p className="text-[13px] font-medium">Variants</p>
          <p className="text-xs text-muted-foreground">
            Each version goes to an equal share of people; the report shows
            which one did better.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="radiogroup"
          aria-label="Variant"
          className="inline-flex rounded-lg border border-sidebar-border bg-background p-0.5"
        >
          {variants.map((variant) => {
            const on = variant.id === selected;
            return (
              <button
                key={variant.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={variant.id.toUpperCase()}
                onClick={() => onSelect(variant.id)}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                  on
                    ? "bg-accent text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="font-semibold">
                  {variant.id.toUpperCase()}
                </span>
                <span
                  className={cn(
                    "font-normal",
                    on ? "text-primary/70" : "text-muted-foreground/70"
                  )}
                >
                  {short(variant.title)}
                </span>
              </button>
            );
          })}
        </div>
        {onAdd && variants.length <= VARIANT_IDS.length && (
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            <Plus className="size-3.5" />
            Add variant
          </Button>
        )}
        {removable && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Remove variant ${selected.toUpperCase()}`}
            disabled={removeDisabled}
            onClick={() => onRemove(selected as VariantId)}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      {variants.length > 1 && children}
    </div>
  );
}
