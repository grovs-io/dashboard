"use client";

import { Globe } from "lucide-react";
import type { SourceBreakdown } from "../types";
import {
  AnalyticsEmptyState,
  AnalyticsNoResults,
} from "../AnalyticsEmptyState";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
];

function fmt(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return k >= 10
      ? `${Math.round(k)}K`
      : `${k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return n.toLocaleString();
}

interface SourceBreakdownDonutProps {
  data?: SourceBreakdown[];
  hasFilters?: boolean;
}

export function SourceBreakdownDonut({
  data,
  hasFilters = false,
}: SourceBreakdownDonutProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-sidebar-border bg-background shadow-none overflow-hidden flex flex-col">
        <div className="px-5 py-3 bg-muted/40 border-b border-sidebar-border">
          <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Source Breakdown
          </h3>
        </div>
        {hasFilters ? (
          <AnalyticsNoResults />
        ) : (
          <AnalyticsEmptyState
            icon={Globe}
            title="No source data yet"
            description="See where your users come from — direct links, organic, referrals, and campaigns. Create a deep link and share it to start tracking sources."
            linkHref="/dynamic_links/links"
            linkLabel="Create a link"
          />
        )}
      </div>
    );
  }

  const total = data.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="rounded-xl border border-sidebar-border bg-background shadow-none overflow-hidden flex flex-col">
      <div className="px-5 py-3 bg-muted/40 border-b border-sidebar-border">
        <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Source Breakdown
        </h3>
      </div>

      <div className="flex-1 flex flex-col px-5 py-4">
        {/* Total */}
        <div className="text-center pb-4 border-b border-sidebar-border mb-4">
          <div className="text-2xl font-semibold tabular-nums text-foreground">
            {fmt(total)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            total users
          </div>
        </div>

        {/* Source rows */}
        <div className="flex flex-col gap-3.5">
          {data.map((source, i) => {
            const pct = Math.round((source.value / total) * 100);
            return (
              <div key={source.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[i] }}
                    />
                    <span className="text-[12px] font-medium text-foreground truncate">
                      {source.name}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 shrink-0">
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {fmt(source.value)}
                    </span>
                    <span className="text-[12px] font-semibold tabular-nums text-foreground">
                      {pct}%
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${COLORS[i]}, color-mix(in srgb, ${COLORS[i]} 70%, transparent))`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
