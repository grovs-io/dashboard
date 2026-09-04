"use client";

import Link from "next/link";
import { ArrowRight, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProjectSelection } from "@/context/useProjectSelection";
import type { LucideIcon } from "lucide-react";

interface AnalyticsEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Shown instead of description when any SDK is already configured */
  sdkDescription?: string;
  /** Optional CTA link — hidden when any SDK is already configured */
  linkHref?: string;
  linkLabel?: string;
}

/**
 * Full empty state for when there is no data at all (user hasn't integrated SDK yet).
 * Matches the platform-wide empty state pattern (CampaignsEmptyState, LinksEmptyState, etc.).
 */
export function AnalyticsEmptyState({
  icon: Icon,
  title,
  description,
  sdkDescription,
  linkHref,
  linkLabel,
}: AnalyticsEmptyStateProps) {
  const { getStartedSetup } = useProjectSelection();
  const anySdkConfigured =
    !!getStartedSetup?.ios_sdk ||
    !!getStartedSetup?.android_sdk ||
    !!getStartedSetup?.web_sdk;

  // Only show the CTA when we've confirmed no SDK is configured.
  // When getStartedSetup is still undefined (loading), hide the CTA to avoid
  // briefly showing "Set up the SDK" for users who already have it configured.
  const showLink =
    linkHref && linkLabel && getStartedSetup && !anySdkConfigured;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-14 px-4 w-full bg-sidebar"
    >
      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted mb-4">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>

      <h3 className="text-sm font-semibold text-foreground text-center mb-2">
        {title}
      </h3>

      <p
        className={cn(
          "text-xs text-muted-foreground text-center leading-relaxed max-w-md",
          showLink && "mb-6"
        )}
      >
        {(anySdkConfigured || !getStartedSetup) && sdkDescription
          ? sdkDescription
          : description}
      </p>

      {showLink && (
        <Button className="pl-3 pr-4" asChild>
          <Link href={linkHref}>
            {linkLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}

/**
 * Lighter empty state for when filters/search returned no results.
 * Matches the DataTable "No results found" pattern.
 */
export function AnalyticsNoResults() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-14 px-4 w-full bg-sidebar"
    >
      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted mb-4">
        <SearchX className="h-5 w-5 text-muted-foreground" />
      </div>

      <h3 className="text-sm font-semibold text-foreground text-center mb-2">
        No results found
      </h3>

      <p className="text-xs text-muted-foreground text-center leading-relaxed max-w-md">
        Try adjusting your search, filters, or date range.
      </p>
    </div>
  );
}
