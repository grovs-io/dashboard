"use client";

import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact empty state for the Overview panels. Icon + short title + one-line
 * nudge + a CTA link. `wide` gives a roomier layout for full-width cards.
 */
export function OverviewPanelEmpty({
  icon: Icon,
  title,
  description,
  href,
  label,
  onAction,
  wide = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  label?: string;
  /** When provided, the CTA renders as a button (e.g. opens a modal) instead of navigating to `href`. */
  onAction?: () => void;
  wide?: boolean;
}) {
  const ctaClassName =
    "inline-flex items-center gap-1 text-xs font-medium text-[var(--chart-users)] hover:text-[var(--chart-users-hover)]";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-4 text-center",
        wide ? "py-10" : "py-6"
      )}
    >
      <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mb-1 text-[13px] font-medium text-foreground">{title}</p>
      <p
        className={cn(
          "mb-3 leading-relaxed text-muted-foreground",
          wide ? "max-w-md text-xs" : "max-w-[210px] text-[11.5px]"
        )}
      >
        {description}
      </p>
      {label &&
        (onAction ? (
          <button type="button" onClick={onAction} className={ctaClassName}>
            {label} <ArrowRight className="size-3" />
          </button>
        ) : (
          href && (
            <Link href={href} className={ctaClassName}>
              {label} <ArrowRight className="size-3" />
            </Link>
          )
        ))}
    </div>
  );
}
