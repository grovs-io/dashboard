"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  GitBranch,
  Layers,
  PieChart,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectSelection } from "@/context/useProjectSelection";

const FEATURES = [
  {
    icon: GitBranch,
    title: "User Flow",
    description:
      "Visualize how users move from link click to app open, install, and conversion.",
  },
  {
    icon: Layers,
    title: "Version Comparison",
    description:
      "Compare performance across app versions and platforms side by side.",
  },
  {
    icon: TrendingUp,
    title: "User Trends",
    description:
      "Track daily active users over time and compare against previous periods.",
  },
  {
    icon: PieChart,
    title: "Source Breakdown",
    description:
      "See which channels and campaigns drive the most traffic and conversions.",
  },
];

/**
 * Full-page empty state for the Analytics Overview when no data has been received.
 * Matches the Revenue Tracking upsell pattern: gradient hero + feature cards.
 */
export function AnalyticsOverviewEmpty() {
  const { getStartedSetup } = useProjectSelection();
  const anySdkConfigured =
    !!getStartedSetup?.ios_sdk ||
    !!getStartedSetup?.android_sdk ||
    !!getStartedSetup?.web_sdk;

  return (
    <div className="flex flex-col w-full">
      {/* Hero banner */}
      <div
        className="px-8 pt-12 pb-10 flex flex-col items-center text-center"
        style={{ background: "var(--hero-gradient)" }}
      >
        <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-foreground mb-5">
          <Activity className="h-5 w-5 text-background" />
        </div>

        <h2 className="text-xl font-semibold tracking-tight mb-2">Analytics</h2>

        <p className="text-sm text-muted-foreground leading-relaxed max-w-md mb-6">
          {anySdkConfigured
            ? "No analytics data received yet. Data will appear here once your first users are tracked."
            : "Understand how users discover, install, and engage with your app. Integrate the Grovs SDK to start collecting data automatically."}
        </p>

        {!anySdkConfigured && (
          <>
            <Button size="lg" className="px-8" asChild>
              <Link href="/developers">
                Set up the SDK
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>

            <p className="text-[11px] text-muted-foreground/50 mt-2.5">
              Data populates automatically once your first users are tracked
            </p>
          </>
        )}
      </div>

      {/* Feature cards */}
      <div className="max-w-3xl w-full mx-auto px-8 py-10">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          What you get
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3.5 rounded-xl border border-sidebar-border bg-muted/50 dark:bg-card p-4"
            >
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted shrink-0 mt-0.5">
                <feature.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{feature.title}</span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed mt-6 text-center">
          We automatically collect user flows, retention cohorts, events, and
          version metrics through our SDKs.
        </p>
      </div>
    </div>
  );
}
