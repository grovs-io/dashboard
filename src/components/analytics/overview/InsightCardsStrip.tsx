"use client";

import { cn } from "@/lib/utils";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { insightCards } from "../mock-data";

function getConversionBadge(rate: number) {
  if (rate >= 60)
    return {
      className:
        "bg-valid-green-light-2 text-valid-green dark:bg-valid-green/15 dark:text-emerald-400",
      icon: TrendingUp,
    };
  if (rate >= 30)
    return {
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
      icon: TrendingUp,
    };
  return {
    className:
      "bg-destructive-secondary text-destructive dark:bg-destructive/15 dark:text-red-400",
    icon: TrendingDown,
  };
}

export function InsightCardsStrip() {
  return (
    <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
      {insightCards.map((card, index) => {
        const badge = getConversionBadge(card.conversionRate);
        const BadgeIcon = badge.icon;

        return (
          <div key={card.label} className="flex items-stretch gap-2">
            <div className="flex flex-col gap-1.5 rounded-xl border border-sidebar-border bg-muted/50 p-4 min-w-[170px] flex-shrink-0">
              <span className="text-sm text-muted-foreground">
                {card.label}
              </span>
              <span className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                {card.formattedValue}
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                    badge.className
                  )}
                >
                  <BadgeIcon className="h-3 w-3" />
                  {card.conversionRate}%
                </span>
              </div>
              {card.insight && (
                <span className="text-[11px] text-muted-foreground/70 leading-tight line-clamp-2 mt-1">
                  {card.insight}
                </span>
              )}
            </div>
            {index < insightCards.length - 1 && (
              <div className="flex items-center flex-shrink-0">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
