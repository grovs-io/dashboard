"use client";

import { AlertCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AnalyticsNoticeVariant = "error" | "warning";

interface AnalyticsNoticeProps {
  variant?: AnalyticsNoticeVariant;
  title: string;
  description: string;
  /** Render an "Upgrade plan" CTA that opens the in-app upgrade popup. */
  onUpgrade?: () => void;
  /** Optional retry handler — shown as a secondary action. */
  onRetry?: () => void;
  className?: string;
}

/**
 * Inline notice for analytics limits — hard errors (query failed) use the
 * destructive token; cautions (cold/heavy proactive warnings) use amber, the
 * same pattern as the custom-domain "pending" notices.
 */
export function AnalyticsNotice({
  variant = "error",
  title,
  description,
  onUpgrade,
  onRetry,
  className,
}: AnalyticsNoticeProps) {
  const isError = variant === "error";
  const Icon = isError ? AlertCircle : AlertTriangle;

  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-md border px-3.5 py-3 text-sm",
        isError
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{title}</span>
          <span className="text-[13px] leading-relaxed opacity-90">
            {description}
          </span>
        </div>
        {(onUpgrade || onRetry) && (
          <div className="flex items-center gap-2">
            {onUpgrade && (
              <Button size="sm" onClick={onUpgrade}>
                Upgrade plan
              </Button>
            )}
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                Try again
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
