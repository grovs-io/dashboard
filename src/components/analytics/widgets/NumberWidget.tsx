"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  numberFormatter,
  pct,
} from "@/components/analytics/overview/metricFormat";
import type { WidgetData } from "./types";

export function DeltaPill({
  current,
  previous,
}: {
  current: number;
  previous: number | null | undefined;
}) {
  if (previous == null) return null;
  const delta = pct(current, previous);
  if (delta === 0) return null;
  const Trend = delta < 0 ? TrendingDown : TrendingUp;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums",
        delta > 0
          ? "bg-valid-green-light-2 text-valid-green dark:bg-valid-green/15 dark:text-emerald-400"
          : "bg-destructive-secondary text-destructive dark:bg-destructive/15 dark:text-red-400"
      )}
    >
      <Trend className="size-3" />
      {Math.abs(delta)}%
    </span>
  );
}

export function NumberWidget({ data }: { data: WidgetData }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold tabular-nums tracking-tight">
        {numberFormatter.format(data.total.value)}
      </span>
      <DeltaPill current={data.total.value} previous={data.total.previous} />
    </div>
  );
}
