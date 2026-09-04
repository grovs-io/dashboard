"use client";

import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrencyFromCents } from "@/utils/formatCurrency";
import { OverviewPanelEmpty } from "./OverviewPanelEmpty";

const numberFormatter = new Intl.NumberFormat("de-DE");

export type TopListItem = {
  id: string;
  name: string;
  value: number;
  /** Revenue in cents — shown as a secondary line when > 0. */
  revenueCents?: number;
};

export type TopListEmpty = {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  label: string;
  /** When set, the CTA opens a modal / runs this handler instead of navigating to `href`. */
  onAction?: () => void;
};

/**
 * Compact "top N" teaser for the Overview scoreboard. Ranked list with a
 * magnitude bar per row (visually consistent with the Channels panel), linking
 * out to the full table on its dedicated page.
 */
export function OverviewTopList({
  title,
  viewAllHref,
  items,
  unitLabel,
  loading,
  empty,
  onItemClick,
}: {
  title: string;
  viewAllHref: string;
  items: TopListItem[];
  unitLabel: string;
  loading?: boolean;
  empty: TopListEmpty;
  /** When provided, each row becomes clickable (opens a modal / navigates). */
  onItemClick?: (id: string) => void;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="rounded-md border border-sidebar-border bg-muted/50 p-4 dark:bg-card">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        {!loading && items.length > 0 && (
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 text-xs text-[var(--chart-users)] hover:text-[var(--chart-users-hover)]"
          >
            View all <ArrowRight className="size-3" />
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <OverviewPanelEmpty
          icon={empty.icon}
          title={empty.title}
          description={empty.description}
          href={empty.href}
          label={empty.label}
          onAction={empty.onAction}
        />
      ) : (
        <div className="flex flex-col gap-3.5">
          {items.map((it, i) => {
            const w = Math.round((it.value / max) * 100);
            const rowInner = (
              <>
                <div className="flex items-start justify-between gap-2.5 text-[12.5px]">
                  <span className="flex min-w-0 items-center gap-2.5 pt-0.5">
                    <span className="flex size-[18px] flex-shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <span
                      className={cn(
                        "truncate font-medium",
                        onItemClick && "group-hover:text-[var(--chart-users)]"
                      )}
                    >
                      {it.name}
                    </span>
                  </span>
                  <span className="flex flex-shrink-0 flex-col items-end leading-tight">
                    <span className="tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {numberFormatter.format(it.value)}
                      </span>{" "}
                      {unitLabel}
                    </span>
                    {it.revenueCents != null && it.revenueCents > 0 && (
                      <span className="mt-0.5 text-[11px] font-medium tabular-nums text-valid-green">
                        {formatCurrencyFromCents(it.revenueCents)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="ml-[28px] h-[5px] overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--chart-users)] opacity-70"
                    style={{ width: `${w}%` }}
                  />
                </div>
              </>
            );

            return onItemClick ? (
              <button
                key={it.id}
                type="button"
                onClick={() => onItemClick(it.id)}
                className="group -mx-1.5 flex cursor-pointer flex-col gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chart-users)]/40 dark:hover:bg-muted/60"
              >
                {rowInner}
              </button>
            ) : (
              <div key={it.id} className="flex flex-col gap-1.5">
                {rowInner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
