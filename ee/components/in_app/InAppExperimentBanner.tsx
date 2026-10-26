"use client";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { canEdit, clickRate } from "@ee/lib/inApp";
import { windowLabel, type VariantKey } from "@ee/lib/inAppComposer";
import { variantRates, type VariantRate } from "@ee/lib/experimentLeader";
import { experimentSentence } from "@ee/components/experiments/ExperimentCard";
import { useInAppExperimentQuery } from "@ee/hooks/queries/useInAppQueries";
import type { Experiment } from "@ee/types/experiment";
import type { InAppCampaign } from "@ee/types/inApp";
import UseForEveryoneDialog from "./UseForEveryoneDialog";

const CONFIDENT = 0.95;

export interface Verdict {
  text: string;
  // The variant worth rolling out, when the experiment is conclusive.
  winner: VariantKey | null;
}

// What the experiment says so far, in one line.
export function inAppVerdict(
  experiment: Experiment,
  campaign: Pick<InAppCampaign, "launched_at" | "status">
): Verdict {
  const metric = experiment.goal ? "conversions" : "opens";
  const rates = variantRates(experiment, metric);
  const control = experiment.control_group !== null;
  if (rates.length <= 1) {
    // A goal alone: what the message led to, nothing to compare against.
    if (experiment.goal && !control && rates[0]) {
      const a = rates[0].group;
      return {
        text: `${(a.converted ?? 0).toLocaleString()} of ${a.exposed.toLocaleString()} people converted (${clickRate(a.conversion_rate ?? 0)}) within ${windowLabel(experiment.goal.window_hours)} of seeing the message.`,
        winner: null,
      };
    }
    return {
      text: experimentSentence(experiment, canEdit(campaign)) ?? "",
      winner: null,
    };
  }

  const a = rates[0]!;
  const others = rates.slice(1);
  const best = others
    .filter((r) => r.rate !== null)
    .sort((x, y) => y.rate! - x.rate!)[0];
  const kind = experiment.goal ? "conversion" : "click";
  const sure = (experiment.confidence ?? 0) >= CONFIDENT;
  const controlGroup = experiment.groups.find((g) => g.id === "control");
  const treatedConverted = rates.some((r) => (r.group.converted ?? 0) > 0);
  const beat =
    control && sure && experiment.lift !== null && experiment.lift > 0
      ? ` · variants beat the control by ${Math.round(experiment.lift * 100)}%`
      : control &&
          sure &&
          experiment.lift === null &&
          controlGroup?.converted === 0 &&
          treatedConverted
        ? " · the control converted nobody"
        : "";
  const verdict = (
    win: VariantKey,
    lose: VariantKey,
    winRate: number,
    loseRate: number,
    confidence: number
  ) =>
    `${win.toUpperCase()} does better than ${lose.toUpperCase()}: ${clickRate(winRate)} vs ${clickRate(loseRate)} ${kind} rate (${Math.round(confidence * 100)}% confidence)${beat}.`;

  if (
    best &&
    a.rate !== null &&
    best.rate! > a.rate &&
    (best.group.confidence ?? 0) >= CONFIDENT
  )
    return {
      text: verdict(best.id, "a", best.rate!, a.rate, best.group.confidence!),
      winner: best.id,
    };
  // `confidence` is P(variant beats A): a variant that is worse is sure when its complement is.
  const worse = (r: VariantRate) =>
    r.group.confidence === null ? 0 : 1 - r.group.confidence;
  const aWins =
    a.rate !== null &&
    others.every(
      (r) => r.rate !== null && r.rate < a.rate! && worse(r) >= CONFIDENT
    );
  if (aWins && best)
    return {
      text: verdict(
        "a",
        best.id,
        a.rate!,
        best.rate!,
        Math.min(...others.map(worse))
      ),
      winner: "a",
    };

  const since = campaign.launched_at
    ? ` since ${format(parseISO(campaign.launched_at), "d MMM yyyy")}`
    : "";
  const saw = rates
    .map((r) => `${r.group.exposed.toLocaleString()} saw ${r.id.toUpperCase()}`)
    .join(", ");
  // `more_people_needed` compares the variants with the control, not B with A: not quoted here.
  return {
    text: `Experiment running${since} · ${saw} · not enough people yet for a clear answer.`,
    winner: null,
  };
}

// Under the report header: where the experiment stands, and the roll-out when it is settled.
export default function InAppExperimentBanner({
  projectId,
  campaign,
  period,
  onDuplicated,
}: {
  projectId: string;
  campaign: InAppCampaign;
  period: { from: string; to: string };
  onDuplicated: (draftId: string) => void;
}) {
  const query = useInAppExperimentQuery(projectId, campaign.id, period, true);
  const [asking, setAsking] = useState<VariantKey | null>(null);
  const banner =
    "rounded-md border border-sidebar-border bg-muted/50 p-3 text-[13px]";
  if (query.isPending)
    return (
      <div
        role="status"
        aria-label="Loading experiment summary"
        className={banner}
      >
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  if (query.isError || !query.data) return null;
  const { text, winner } = inAppVerdict(query.data, campaign);
  if (!text) return null;
  // A journey step is changed from its journey only.
  const act =
    winner && campaign.audience.type !== "journey" && canEdit(campaign);
  return (
    <div
      role="status"
      className={`${banner} flex flex-wrap items-center justify-between gap-3`}
    >
      <p className="min-w-0 flex-1">{text}</p>
      {act && (
        <Button type="button" size="sm" onClick={() => setAsking(winner)}>
          Use {winner.toUpperCase()} for everyone
        </Button>
      )}
      <UseForEveryoneDialog
        projectId={projectId}
        campaign={campaign}
        variant={asking}
        onClose={() => setAsking(null)}
        onDuplicated={onDuplicated}
      />
    </div>
  );
}
