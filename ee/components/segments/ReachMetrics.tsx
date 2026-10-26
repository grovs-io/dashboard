"use client";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { IncompleteBadge, SegmentError } from "./SegmentNotices";
import type { SegmentCount, SegmentSizePoint } from "@ee/types/segments";

interface Props {
  count: SegmentCount | undefined;
  pending: boolean;
  error: unknown;
  onRetry: () => void;
  history?: SegmentSizePoint[];
  updatedAt?: string;
}

function Tile({
  label,
  value,
  hint,
  dot,
  className,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  dot?: "persons" | "devices";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-[150px] flex-1 flex-col gap-1 rounded-[10px] border border-sidebar-border bg-muted/40 px-4 py-3 dark:bg-card",
        className
      )}
    >
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {dot && (
          <span
            className={cn(
              "size-1.5 rounded-full",
              dot === "persons"
                ? "bg-[var(--chart-users)]"
                : "bg-[var(--chart-2)]"
            )}
          />
        )}
        {label}
      </span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

const compact = (n: number) => n.toLocaleString();

export default function ReachMetrics({
  count,
  pending,
  error,
  onRetry,
  history = [],
  updatedAt,
}: Props) {
  if (error)
    return (
      <SegmentError
        error={error}
        fallback="Could not count this segment."
        onRetry={onRetry}
      />
    );
  if (pending || !count)
    return (
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-[86px] min-w-[150px] flex-1 rounded-[10px]" />
        <Skeleton className="h-[86px] min-w-[150px] flex-1 rounded-[10px]" />
        <Skeleton className="h-[86px] min-w-[150px] flex-1 rounded-[10px]" />
      </div>
    );
  const newest = history[0];
  const oldest =
    history.length > 1 ? history[Math.min(history.length - 1, 6)] : undefined;
  const delta = newest && oldest ? newest.persons - oldest.persons : null;
  const deltaPct =
    delta !== null && oldest && oldest.persons > 0
      ? Math.round((delta / oldest.persons) * 100)
      : null;
  return (
    <div className="flex flex-wrap gap-2">
      <Tile
        label="People"
        value={compact(count.persons)}
        dot="persons"
        hint={
          count.incomplete ? (
            <span className="flex items-center gap-1.5">
              <IncompleteBadge /> partly past retention
            </span>
          ) : (
            "matching right now"
          )
        }
      />
      <Tile
        label="Devices"
        value={compact(count.devices)}
        dot="devices"
        hint={
          count.persons
            ? `${(count.devices / count.persons).toFixed(2)} per person`
            : undefined
        }
      />
      <Tile
        label="Last 7 days"
        value={
          delta === null ? "—" : `${delta >= 0 ? "+" : ""}${compact(delta)}`
        }
        hint={
          delta === null
            ? "not enough history yet"
            : deltaPct === null
              ? "people"
              : `${deltaPct >= 0 ? "+" : ""}${deltaPct}% people`
        }
        className={
          delta !== null && delta < 0
            ? "[&>span:nth-child(2)]:text-destructive"
            : undefined
        }
      />
      <Tile
        label="Last count"
        value={
          newest
            ? formatDistanceToNow(parseISO(newest.date), { addSuffix: true })
            : "—"
        }
        hint={
          newest
            ? `${compact(newest.persons)} people on ${newest.date}`
            : "updated daily"
        }
        className="[&>span:nth-child(2)]:text-lg [&>span:nth-child(2)]:leading-8"
      />
      {updatedAt && <span className="sr-only">Updated {updatedAt}</span>}
    </div>
  );
}
