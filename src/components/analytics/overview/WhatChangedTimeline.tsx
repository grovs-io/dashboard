"use client";

import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { timelineEntries } from "../mock-data";
import type { TimelineEntry } from "../types";

const typeConfig: Record<
  TimelineEntry["type"],
  { icon: React.ElementType; color: string; dotColor: string }
> = {
  positive: {
    icon: TrendingUp,
    color: "text-valid-green dark:text-emerald-400",
    dotColor: "bg-valid-green",
  },
  negative: {
    icon: TrendingDown,
    color: "text-destructive dark:text-red-400",
    dotColor: "bg-destructive",
  },
  info: {
    icon: AlertCircle,
    color: "text-chart-users",
    dotColor: "bg-chart-users",
  },
};

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function WhatChangedTimeline() {
  return (
    <div className="rounded-md border border-sidebar-border bg-background p-6 shadow-none">
      <div className="mb-4">
        <h3 className="text-base font-semibold">What Changed</h3>
      </div>
      <div className="relative space-y-0">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-sidebar-border" />

        {timelineEntries.map((entry) => {
          const config = typeConfig[entry.type];
          const Icon = config.icon;

          return (
            <div
              key={entry.id}
              className="relative flex items-start gap-3 py-2.5 group cursor-pointer"
            >
              {/* Dot */}
              <div
                className={cn(
                  "relative z-10 mt-1.5 h-[15px] w-[15px] rounded-full border-2 border-background flex-shrink-0",
                  config.dotColor
                )}
              />

              {/* Content */}
              <div className="flex flex-1 items-start justify-between gap-2 min-w-0">
                <div className="flex items-start gap-2 min-w-0">
                  <Icon
                    className={cn("h-4 w-4 mt-0.5 flex-shrink-0", config.color)}
                  />
                  <span className="text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {entry.message}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {formatRelativeDate(entry.date)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
