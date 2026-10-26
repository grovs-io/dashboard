"use client";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  PUSH_EXPERIMENT_CARD_ID,
  awaitingWinner,
  untilLabel,
} from "@ee/lib/push";
import {
  leaderOf,
  MIN_PEOPLE,
  leaderSentence,
  underMinPeople,
  variantRates,
  type Metric,
} from "@ee/lib/experimentLeader";
import { usePushExperimentQuery } from "@ee/hooks/queries/usePushQueries";
import type { PushCampaign } from "@ee/types/push";
import SendWinnerDialog from "./SendWinnerDialog";

// A second-by-second clock, only while there is a countdown to show.
function useNow(on: boolean) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!on) return;
    const tick = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(tick);
  }, [on]);
  return now;
}

const BANNER =
  "rounded-md border border-sidebar-border bg-muted/50 p-3 text-[13px]";

// What happens to the people outside the test share: a countdown or a nudge, who leads, and the actions.
export default function PushWinnerBanner({
  projectId,
  campaign,
}: {
  projectId: string;
  campaign: PushCampaign;
}) {
  const pending = awaitingWinner(campaign);
  const timed = pending && !!campaign.winner_due_at;
  const now = useNow(timed);
  const query = usePushExperimentQuery(
    projectId,
    campaign.id,
    pending,
    pending
  );
  const [asking, setAsking] = useState<"a" | "b" | "c" | null>(null);

  if (!pending) {
    if (!campaign.winner) return null;
    const variant = `Variant ${campaign.winner.toUpperCase()}`;
    return campaign.status === "sending" ? (
      <p role="status" className={BANNER}>
        {variant} is going out to the rest…
      </p>
    ) : (
      <p role="status" className="text-[13px] text-muted-foreground">
        {variant} was sent to the rest
        {campaign.winner_after_minutes ? " automatically" : ""}.
      </p>
    );
  }

  const metric: Metric = campaign.winner_by ?? "opens";
  const rates = query.data ? variantRates(query.data, metric) : [];
  const { leader } = leaderOf(rates);
  const lead = leaderSentence(rates);
  const people = (campaign.report.waiting ?? 0).toLocaleString();
  const toCard = () =>
    document
      .getElementById(PUSH_EXPERIMENT_CARD_ID)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div
      role="status"
      className={`${BANNER} flex flex-wrap items-start justify-between gap-3`}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-medium">
          {timed
            ? `${people} people are waiting for the winner`
            : `${people} people are waiting for you to pick the winner`}
        </p>
        <p className="text-muted-foreground">
          {timed
            ? `Goes out automatically in ${untilLabel(campaign.winner_due_at!, now)} (at ${format(parseISO(campaign.winner_due_at!), "d MMM yyyy, HH:mm")})`
            : "Waiting for you to pick the winner"}
        </p>
        <p className="text-muted-foreground">
          Judged by {metric}
          {lead ? ` · ${lead}` : ""}
          {timed && lead && underMinPeople(rates)
            ? ` · A goes out unless every variant reaches ${MIN_PEOPLE} people`
            : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={toCard}>
          Choose a variant
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!leader}
          title={leader ? undefined : "Waiting for data"}
          onClick={() => leader && setAsking(leader.id)}
        >
          Send {leader?.id.toUpperCase() ?? "the leader"} to the rest
          {timed ? " now" : ""}
        </Button>
      </div>
      <SendWinnerDialog
        projectId={projectId}
        campaign={campaign}
        variant={asking}
        onClose={() => setAsking(null)}
      />
    </div>
  );
}
