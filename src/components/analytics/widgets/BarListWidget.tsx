"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { numberFormatter } from "@/components/analytics/overview/metricFormat";
import { bucketLabel, OTHER_KEY } from "@/lib/metricQuery";
import { DeltaPill } from "./NumberWidget";
import type { RowClickHandler, WidgetData } from "./types";

/** `compact` flows rows into two columns, ranked top to bottom, on wide containers. */
export function BarListWidget({
  data,
  onRowClick,
  compact = false,
  onShowMore,
}: {
  data: WidgetData;
  onRowClick?: RowClickHandler;
  compact?: boolean;
  onShowMore?: () => void;
}) {
  const rows =
    data.other && data.other.value > 0 ? [...data.rows, data.other] : data.rows;
  const total = Math.max(data.total.value, 1);
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div
      className={cn(
        compact
          ? "grid grid-cols-1 gap-x-10 gap-y-2 @3xl/main:grid-flow-col @3xl/main:grid-cols-2"
          : "flex flex-col gap-3"
      )}
      style={
        compact
          ? { gridTemplateRows: `repeat(${Math.ceil(rows.length / 2)}, auto)` }
          : undefined
      }
    >
      {rows.map((r) => {
        const isOther = r.key === OTHER_KEY;
        const label = isOther ? "Other" : bucketLabel(data.group_by, r);
        const share = Math.round((r.value / total) * 100);
        const clickable = !isOther && !!onRowClick;
        const inner = (
          <>
            <div
              className={cn(
                "flex items-center justify-between gap-2",
                compact ? "text-[12.5px]" : "text-[13px]"
              )}
            >
              <span
                className={cn(
                  "truncate",
                  isOther ? "text-muted-foreground" : "font-medium"
                )}
              >
                {label}
                {isOther && onShowMore && (
                  <span className="ml-1.5 text-[11px] font-medium text-[var(--chart-users)]">
                    Show more
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                <span className="font-semibold">
                  {numberFormatter.format(r.value)}
                </span>
                <span className="text-muted-foreground">{share}%</span>
                <DeltaPill current={r.value} previous={r.previous} />
                {clickable && (
                  <ChevronRight
                    aria-hidden
                    className="-mr-1 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  />
                )}
              </span>
            </div>
            <div
              className={cn(
                "overflow-hidden rounded-full bg-muted",
                compact ? "h-1" : "h-1.5"
              )}
            >
              <div
                className={cn(
                  "h-full rounded-full",
                  isOther ? "bg-muted-foreground/40" : "bg-[var(--chart-users)]"
                )}
                style={{ width: `${Math.round((r.value / max) * 100)}%` }}
              />
            </div>
          </>
        );
        const action = isOther
          ? onShowMore && { label: "Show more values", onClick: onShowMore }
          : onRowClick && { label, onClick: () => onRowClick(r.key, label) };
        return action ? (
          <button
            key={r.key}
            type="button"
            aria-label={action.label}
            onClick={action.onClick}
            className={cn(
              "group -mx-2 flex cursor-pointer flex-col rounded-md px-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chart-users)]/40 dark:hover:bg-muted/60",
              compact ? "gap-1 py-0.5" : "gap-1.5 py-1"
            )}
          >
            {inner}
          </button>
        ) : (
          <div
            key={r.key}
            className={cn("flex flex-col", compact ? "gap-1" : "gap-1.5")}
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
}
