"use client";
import { format } from "date-fns";
import { Pencil, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Experiment } from "@ee/types/experiment";
import type { Journey, JourneyReport } from "@ee/types/journey";

const BANNER =
  "flex flex-wrap items-center justify-between gap-3 rounded-md border border-sidebar-border bg-muted/50 p-3 text-[13px]";
const n = (v: number) => v.toLocaleString();
const pct = (v: number) => `${Math.round(v * 100)}%`;

// What the goal says against the control, in a few words; null without a goal to measure.
export function goalVerdict(goal: Experiment | null): string | null {
  if (!goal?.goal || goal.control_group === null) return null;
  const { lift, confidence } = goal;
  if (lift === null || confidence === null)
    return "not enough people yet for a clear answer";
  const sure = lift < 0 ? 1 - confidence : confidence;
  if (sure < 0.95) return "not enough people yet for a clear answer";
  return lift < 0
    ? `converts ${pct(-lift)} worse than the control (${pct(sure)} confidence)`
    : `converts ${pct(lift)} better than the control (${pct(sure)} confidence)`;
}

// Counts come from the report only; a single journey carries no stats.
export function bannerText(journey: Journey, report?: JourneyReport): string {
  switch (journey.status) {
    case "draft":
      return "Draft: not live yet.";
    case "paused":
      return `Paused: nobody moves or enters until you resume.${report ? ` ${n(report.active)} people are waiting where they are.` : ""}`;
    case "ended":
      return `Ended ${journey.ended_at ? format(new Date(journey.ended_at), "d MMM yyyy") : ""}: nobody new enters${report ? `; ${n(report.active)} people are finishing.` : "."}`;
    case "live": {
      if (!report) return "Live: people enter and move through it.";
      const parts = [`${n(report.active)} people are in the journey now`];
      parts.push(`${n(report.entered)} entered in the period`);
      const verdict = goalVerdict(report.goal);
      if (verdict) parts.push(verdict);
      return parts.join(" · ");
    }
  }
}

// Under the header: where the journey stands, with the one action that fits.
export default function JourneyStatusBanner({
  journey,
  report,
  loading,
  onResume,
  onEdit,
}: {
  journey: Journey;
  report?: JourneyReport;
  loading: boolean;
  onResume: () => void;
  onEdit: () => void;
}) {
  if (loading && journey.status === "live")
    return (
      <div role="status" aria-label="Loading summary" className={BANNER}>
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  return (
    <div role="status" className={BANNER}>
      <p className="min-w-0 flex-1">{bannerText(journey, report)}</p>
      {journey.status === "paused" && (
        <Button size="sm" onClick={onResume}>
          <Play className="size-3.5" />
          Resume
        </Button>
      )}
      {journey.status === "draft" && (
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil className="size-3.5" />
          Edit
        </Button>
      )}
    </div>
  );
}
