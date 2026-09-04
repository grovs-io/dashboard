"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ChevronDown,
  Check,
  ArrowLeftRight,
  AlertTriangle,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { PlatformIcon, fmtNumber as fmt } from "../shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GitCompareArrows } from "lucide-react";
import type { FunnelStage } from "../types";
import type { AnalyticsOverviewParams } from "@/types";
import {
  AnalyticsEmptyState,
  AnalyticsNoResults,
} from "../AnalyticsEmptyState";
import { useProjectSelection } from "@/context/useProjectSelection";
import {
  useOverviewVersionDistributionQuery,
  useOverviewVersionFunnelQuery,
} from "@/hooks/queries/useAnalyticsOverviewQueries";

const platformOptions = ["iOS", "Android", "Web"] as const;

interface VersionPlatformHeatmapProps {
  hasFilters?: boolean;
  overviewParams?: AnalyticsOverviewParams;
}

function getRateColor(rate: number): string {
  if (rate >= 70) return "text-valid-green dark:text-emerald-400";
  if (rate >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

function getBarGradient(rate: number): string {
  if (rate >= 70)
    return "linear-gradient(90deg, var(--chart-users), color-mix(in srgb, var(--chart-users) 40%, transparent))";
  if (rate >= 40)
    return "linear-gradient(90deg, var(--chart-users), color-mix(in srgb, var(--chart-users) 30%, transparent))";
  return "linear-gradient(90deg, var(--chart-users), color-mix(in srgb, var(--chart-users) 20%, transparent))";
}

/* ── Insight generation ── */

type Insight = {
  type: "positive" | "negative";
  message: string;
};

function generateInsights(
  leftStages: FunnelStage[],
  rightStages: FunnelStage[],
  leftVersion: string,
  rightVersion: string
): Insight[] {
  if (leftStages.length < 2 || rightStages.length < 2) return [];

  const insights: Insight[] = [];

  // Stage-by-stage: find biggest improvement and biggest regression
  let bestStage = "";
  let bestDiff = 0;
  let worstStage = "";
  let worstDiff = 0;

  const r1 = (n: number) => +n.toFixed(1);

  for (let i = 1; i < Math.min(leftStages.length, rightStages.length); i++) {
    const diff = leftStages[i]!.rate - rightStages[i]!.rate;
    if (diff > bestDiff) {
      bestDiff = diff;
      bestStage = leftStages[i]!.label;
    }
    if (diff < worstDiff) {
      worstDiff = diff;
      worstStage = leftStages[i]!.label;
    }
  }

  if (bestDiff >= 2) {
    const leftRate = r1(leftStages.find((s) => s.label === bestStage)!.rate);
    const rightRate = r1(rightStages.find((s) => s.label === bestStage)!.rate);
    insights.push({
      type: "positive",
      message: `${bestStage} improved by ${r1(bestDiff)}pp in ${leftVersion} vs ${rightVersion} (${leftRate}% vs ${rightRate}%)`,
    });
  }

  if (worstDiff <= -2) {
    const leftRate = r1(leftStages.find((s) => s.label === worstStage)!.rate);
    const rightRate = r1(rightStages.find((s) => s.label === worstStage)!.rate);
    insights.push({
      type: "negative",
      message: `${worstStage} dropped by ${r1(Math.abs(worstDiff))}pp in ${leftVersion} vs ${rightVersion} (${leftRate}% vs ${rightRate}%)`,
    });
  }

  // End-to-end (skip if either funnel starts with 0 users)
  if (leftStages[0]!.users > 0 && rightStages[0]!.users > 0) {
    const leftEnd = r1(
      (leftStages[leftStages.length - 1]!.users / leftStages[0]!.users) * 100
    );
    const rightEnd = r1(
      (rightStages[rightStages.length - 1]!.users / rightStages[0]!.users) * 100
    );
    const endDiff = r1(leftEnd - rightEnd);

    if (endDiff !== 0) {
      insights.push({
        type: endDiff > 0 ? "positive" : "negative",
        message: `${leftVersion} converts ${Math.abs(endDiff)}pp ${endDiff > 0 ? "more" : "fewer"} users from open to conversion than ${rightVersion} (${leftEnd}% vs ${rightEnd}%)`,
      });
    }
  }

  return insights;
}

/* ── Single Funnel Column ── */

function FunnelColumn({
  stages,
  maxUsers,
  platform,
  version,
  onVersionChange,
  onPlatformChange,
  colorIdx,
  allVersions,
  releaseDates,
}: {
  stages: FunnelStage[];
  maxUsers: number;
  platform: string;
  version: string;
  onVersionChange: (v: string) => void;
  onPlatformChange: (p: string) => void;
  colorIdx: number;
  allVersions: string[];
  releaseDates: Record<string, string>;
}) {
  const colors = ["var(--chart-users)", "var(--chart-1)"];
  const color = colors[colorIdx % colors.length]!;
  const releaseDate = releaseDates[version];

  return (
    <div className="flex-1 min-w-[180px] flex flex-col">
      {/* Platform + Version header */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />

        {/* Platform selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-sidebar-border bg-background text-xs font-medium text-foreground hover:bg-muted/50 transition-colors cursor-pointer">
              <PlatformIcon platform={platform} />
              {platform}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {platformOptions.map((p) => {
              return (
                <DropdownMenuItem key={p} onClick={() => onPlatformChange(p)}>
                  <PlatformIcon platform={p} className="mr-2" />
                  <span className="flex-1">{p}</span>
                  {p === platform && (
                    <Check className="h-3.5 w-3.5 ml-2 text-foreground" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Version selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-sidebar-border bg-background text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors cursor-pointer">
              v{version}
              {releaseDate && (
                <span className="font-normal text-muted-foreground">
                  {releaseDate}
                </span>
              )}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {allVersions.map((v) => {
              const rd = releaseDates[v];
              return (
                <DropdownMenuItem key={v} onClick={() => onVersionChange(v)}>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-medium">v{v}</span>
                    {rd && (
                      <span className="text-muted-foreground text-xs">
                        {rd}
                      </span>
                    )}
                  </div>
                  {v === version && (
                    <Check className="h-3.5 w-3.5 ml-2 text-foreground" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Funnel stages */}
      {stages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-muted/60 p-2.5 mb-3">
            <Layers className="h-4 w-4 text-muted-foreground/60" />
          </div>
          <p className="text-xs text-muted-foreground">
            No funnel data for v{version} on {platform}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            {stages.map((stage, i) => {
              const widthPercent =
                maxUsers > 0 ? (stage.users / maxUsers) * 100 : 0;
              const prevStage = stages[i - 1];

              return (
                <div key={stage.label} className="flex flex-col">
                  {i > 0 && (
                    <div className="flex items-center gap-1.5 py-1 pl-1">
                      <ArrowDown className="h-3 w-3 text-muted-foreground/50" />
                      <span
                        className={cn(
                          "text-[11px] font-semibold tabular-nums",
                          getRateColor(stage.rate)
                        )}
                      >
                        {stage.rate}%
                      </span>
                      {prevStage && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          ({fmt(prevStage.users - stage.users)} lost)
                        </span>
                      )}
                    </div>
                  )}

                  <div className="rounded-lg border border-sidebar-border bg-muted/30 overflow-hidden">
                    <div
                      className="px-3 py-2.5 relative"
                      style={{ width: `${Math.max(widthPercent, 30)}%` }}
                    >
                      <div
                        className="absolute inset-0 opacity-15"
                        style={{ background: getBarGradient(stage.rate) }}
                      />
                      <div className="relative flex items-baseline justify-between gap-2">
                        <span className="text-[11px] font-medium text-foreground truncate">
                          {stage.label}
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-foreground flex-shrink-0">
                          {fmt(stage.users)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* End-to-end conversion */}
          {stages.length >= 2 && stages[0]!.users > 0 && (
            <div className="mt-3 pt-3 border-t border-sidebar-border/50">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {fmt(stages[0]!.users)} opened &rarr;{" "}
                  {fmt(stages[stages.length - 1]!.users)} converted
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    getRateColor(
                      Math.round(
                        (stages[stages.length - 1]!.users / stages[0]!.users) *
                          100
                      )
                    )
                  )}
                >
                  {Math.round(
                    (stages[stages.length - 1]!.users / stages[0]!.users) * 100
                  )}
                  %
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Main Component ── */

export function VersionPlatformHeatmap({
  hasFilters = false,
  overviewParams,
}: VersionPlatformHeatmapProps) {
  const { selectedProject } = useProjectSelection();
  const projectId = selectedProject?.id;

  const [leftVersion, setLeftVersion] = useState("");
  const [rightVersion, setRightVersion] = useState("");
  const [platform, setPlatform] = useState<string>("iOS");

  // Fetch version distribution to get the list of available versions
  const distQuery = useOverviewVersionDistributionQuery(
    projectId,
    overviewParams
  );
  const allVersions = useMemo(
    () => distQuery.data?.entries?.map((e) => e.version) ?? [],
    [distQuery.data]
  );
  const releaseDates = useMemo<Record<string, string>>(() => {
    if (!distQuery.data?.entries) return {};
    const map: Record<string, string> = {};
    for (const e of distQuery.data.entries) {
      if (e.release_date) map[e.version] = e.release_date;
    }
    return map;
  }, [distQuery.data]);

  // Resolve effective versions (use state if set, otherwise default to first/second)
  const effectiveLeft = leftVersion || allVersions[0] || "";
  const effectiveRight = rightVersion || allVersions[1] || allVersions[0] || "";

  // Fetch funnel data for each selected version
  const leftFunnelQuery = useOverviewVersionFunnelQuery(
    projectId,
    effectiveLeft || undefined,
    overviewParams
  );
  const rightFunnelQuery = useOverviewVersionFunnelQuery(
    projectId,
    effectiveRight || undefined,
    overviewParams
  );

  const funnelKey = platform.toLowerCase();
  const leftStages = useMemo<FunnelStage[]>(
    () =>
      leftFunnelQuery.data?.funnels[funnelKey]?.map((s) => ({
        label: s.label,
        users: s.users,
        rate: s.rate,
      })) ?? [],
    [leftFunnelQuery.data, funnelKey]
  );
  const rightStages = useMemo<FunnelStage[]>(
    () =>
      rightFunnelQuery.data?.funnels[funnelKey]?.map((s) => ({
        label: s.label,
        users: s.users,
        rate: s.rate,
      })) ?? [],
    [rightFunnelQuery.data, funnelKey]
  );

  const hasData = allVersions.length > 0;

  const insights = useMemo(
    () =>
      !hasData
        ? []
        : generateInsights(
            leftStages,
            rightStages,
            `v${effectiveLeft}`,
            `v${effectiveRight}`
          ),
    [hasData, leftStages, rightStages, effectiveLeft, effectiveRight]
  );

  if (!hasData) {
    return (
      <div className="rounded-xl border border-sidebar-border bg-background shadow-none overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-muted/40 border-b border-sidebar-border">
          <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Version Comparison
          </h3>
        </div>
        {hasFilters ? (
          <AnalyticsNoResults />
        ) : (
          <AnalyticsEmptyState
            icon={GitCompareArrows}
            title="No version data yet"
            description="Compare conversion funnels across app versions to see how updates affect user behavior. Data appears once multiple versions are reported."
            sdkDescription="No version data recorded yet. Data will appear here once multiple versions are reported."
            linkHref="/developers"
            linkLabel="Set up the SDK"
          />
        )}
      </div>
    );
  }

  const maxUsers = Math.max(
    ...leftStages.map((s) => s.users),
    ...rightStages.map((s) => s.users)
  );

  const handleSwap = () => {
    setLeftVersion(effectiveRight);
    setRightVersion(effectiveLeft);
  };

  return (
    <div className="rounded-xl border border-sidebar-border bg-background shadow-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-muted/40 border-b border-sidebar-border">
        <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Version Comparison
        </h3>
      </div>

      {/* Side-by-side funnels */}
      <div className="p-5">
        <div className="flex items-stretch gap-0">
          {/* Left funnel */}
          <div className="flex-1 flex flex-col pr-5">
            {effectiveLeft && (
              <FunnelColumn
                stages={leftStages}
                maxUsers={maxUsers}
                platform={platform}
                version={effectiveLeft}
                onVersionChange={setLeftVersion}
                onPlatformChange={setPlatform}
                colorIdx={0}
                allVersions={allVersions}
                releaseDates={releaseDates}
              />
            )}
          </div>

          {/* Center divider with swap button */}
          <div className="flex flex-col items-center flex-shrink-0 w-9">
            <div className="w-px flex-1 bg-sidebar-border" />
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-full my-2 flex-shrink-0"
              onClick={handleSwap}
              title="Swap versions"
            >
              <ArrowLeftRight className="h-3 w-3" />
            </Button>
            <div className="w-px flex-1 bg-sidebar-border" />
          </div>

          {/* Right funnel */}
          <div className="flex-1 flex flex-col pl-5">
            {effectiveRight && (
              <FunnelColumn
                stages={rightStages}
                maxUsers={maxUsers}
                platform={platform}
                version={effectiveRight}
                onVersionChange={setRightVersion}
                onPlatformChange={setPlatform}
                colorIdx={1}
                allVersions={allVersions}
                releaseDates={releaseDates}
              />
            )}
          </div>
        </div>
      </div>

      {/* Summary footer */}
      {insights.length > 0 && (
        <div className="px-5 py-3 bg-muted/20 border-t border-sidebar-border">
          <div className="flex flex-col gap-1.5">
            {insights.map((insight, i) => {
              const isPositive = insight.type === "positive";
              const Icon = isPositive ? CheckCircle2 : AlertTriangle;
              return (
                <div key={i} className="flex items-start gap-2">
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 flex-shrink-0 mt-0.5",
                      isPositive
                        ? "text-valid-green dark:text-emerald-400"
                        : "text-destructive"
                    )}
                  />
                  <span className="text-xs text-foreground leading-relaxed">
                    {insight.message}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
