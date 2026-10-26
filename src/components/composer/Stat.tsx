import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CARD =
  "rounded-md border border-sidebar-border bg-muted/50 p-4 dark:bg-card";

// As tall as a card with a hint, which is what sets the height of a row.
export function StatSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(CARD, "flex flex-col", className)}>
      <Skeleton className="my-0.5 h-3 w-16" />
      <Skeleton className="mt-1 h-[26px] w-20" />
      <Skeleton className="mb-0.5 mt-2 h-3 w-24" />
    </div>
  );
}

export default function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn(CARD, className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-[26px] font-semibold tabular-nums leading-none">
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
