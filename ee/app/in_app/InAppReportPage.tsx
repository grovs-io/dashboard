"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CircleStop, Copy, Pause, Pencil, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ActionConfirm from "@/components/common/action-confirm";
import { ApiError } from "@/lib/ApiError";
import { cn } from "@/lib/utils";
import {
  canEdit,
  canEnd,
  canPause,
  canResume,
  clickRate,
  failureText,
  inAppErrorText,
  isInAppNotEnabled,
} from "@ee/lib/inApp";
import {
  draftFromCampaign,
  withVariant,
  type VariantKey,
} from "@ee/lib/inAppComposer";
import VariantBar from "@ee/components/experiments/VariantBar";
import {
  useInAppCampaignQuery,
  useInAppReportQuery,
  useInAppSettingsQuery,
} from "@ee/hooks/queries/useInAppQueries";
import { useSegmentsQuery } from "@ee/hooks/queries/useSegmentsQueries";
import { useInAppCampaignActions } from "@ee/hooks/useInAppCampaignActions";
import { useInAppAudienceUpdate } from "@ee/hooks/mutations/useInAppMutations";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import { Choice } from "@/components/composer/fields";
import PreviewPanel, {
  PreviewSkeleton,
} from "@ee/components/in_app/composer/PreviewPanel";
import InAppAnswers, {
  AnswersSkeleton,
} from "@ee/components/in_app/InAppAnswers";
import InAppExperimentBanner from "@ee/components/in_app/InAppExperimentBanner";
import InAppExperimentCard from "@ee/components/in_app/InAppExperimentCard";
import InAppExportButton from "@ee/components/in_app/InAppExportButton";
import InAppCampaignDialog from "@ee/components/in_app/InAppCampaignDialog";
import Stat, { StatSkeleton } from "@/components/composer/Stat";
import InAppStatusPill from "@ee/components/in_app/InAppStatusPill";
import InAppSummary from "@ee/components/in_app/InAppSummary";
import InAppTrendChart from "@ee/components/in_app/InAppTrendChart";
import ReportCard from "@ee/components/push/ReportCard";
import PushShell, { type PushContext } from "@ee/app/push/PushShell";
import type { InAppCampaign, InAppReport } from "@ee/types/inApp";

const RANGES = [
  { value: "1", label: "Today (UTC), by hour" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;
type Range = (typeof RANGES)[number]["value"];

// The report counts days in UTC, so the range is asked for in UTC too.
const day = (date: Date) => date.toISOString().slice(0, 10);

export const reportRange = (days: number, now: Date) => ({
  from: day(new Date(now.getTime() - (days - 1) * 86_400_000)),
  to: day(now),
  by: days === 1 ? ("hour" as const) : ("day" as const),
});

function Rows({
  empty,
  head,
  rows,
}: {
  empty: string;
  head: string[];
  rows: (string | number)[][];
}) {
  if (rows.length === 0)
    return <p className="text-[13px] text-muted-foreground">{empty}</p>;
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          {head.map((h, i) => (
            <th
              key={h}
              className={i ? "pb-2 text-right font-medium" : "pb-2 font-medium"}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={String(row[0])} className="border-t border-sidebar-border">
            {row.map((cell, i) => (
              <td
                key={i}
                className={i ? "py-2 text-right tabular-nums" : "py-2"}
              >
                {typeof cell === "number" ? cell.toLocaleString() : cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Five cards in rows of three and two, each row filled from edge to edge.
const ASKED_CARD = [
  "md:col-span-2 2xl:col-span-1",
  "md:col-span-2 2xl:col-span-1",
  "md:col-span-2 2xl:col-span-1",
  "md:col-span-3 2xl:col-span-1",
  "col-span-2 md:col-span-3 2xl:col-span-1",
];
const ASKED_GRID = "grid grid-cols-2 gap-3 md:grid-cols-6 2xl:grid-cols-5";
const CARDS_GRID = "grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5";

export const answerRate = (answers: number, views: number) =>
  views > 0 ? `${((answers / views) * 100).toFixed(1)}%` : "0%";

function Numbers({
  campaign,
  report,
  experiment,
}: {
  campaign: InAppCampaign;
  report: InAppReport;
  // The experiment card, when the campaign has one to show.
  experiment?: ReactNode;
}) {
  const { totals } = report;
  // A message that asks a question has no buttons, so answers stand where clicks would.
  const asked = !!campaign.content.question;
  const answers = report.answers?.count ?? 0;
  const labels = new Map(
    (campaign.content.buttons ?? []).map((b) => [b.id, b.text])
  );
  const card = (i: number) => (asked ? ASKED_CARD[i] : undefined);
  return (
    <>
      <div className={asked ? ASKED_GRID : CARDS_GRID}>
        <Stat
          className={card(0)}
          label="Views"
          value={totals.views.toLocaleString()}
          hint={`${totals.unique_viewers.toLocaleString()} devices`}
        />
        {asked ? (
          <>
            <Stat
              className={card(1)}
              label="Answers"
              value={answers.toLocaleString()}
            />
            <Stat
              className={card(2)}
              label="Answer rate"
              value={answerRate(answers, totals.views)}
            />
          </>
        ) : (
          <>
            <Stat
              label="Clicks"
              value={totals.clicks.toLocaleString()}
              hint={`${totals.unique_clickers.toLocaleString()} devices`}
            />
            <Stat label="Click rate" value={clickRate(totals.click_rate)} />
          </>
        )}
        <Stat
          className={card(3)}
          label="Dismissals"
          value={totals.dismissals.toLocaleString()}
        />
        <Stat
          className={card(4)}
          label="Devices that may see it"
          value={
            report.eligible_devices === null
              ? "All"
              : report.eligible_devices.toLocaleString()
          }
          hint={
            report.eligible_devices === null ? "Everyone" : "In the segment"
          }
        />
      </div>
      {experiment}
      <ReportCard title="Over time">
        <InAppTrendChart trend={report.trend} clicks={!asked} />
      </ReportCard>
      {asked ? (
        <ReportCard title="By platform">
          <Rows
            empty="No views yet."
            head={["Platform", "Views", "Dismissals"]}
            rows={report.platforms.map((p) => [
              p.platform || "unknown",
              p.views,
              p.dismissals,
            ])}
          />
        </ReportCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportCard title="By platform">
            <Rows
              empty="No views yet."
              head={["Platform", "Views", "Clicks", "Dismissals"]}
              rows={report.platforms.map((p) => [
                p.platform || "unknown",
                p.views,
                p.clicks,
                p.dismissals,
              ])}
            />
          </ReportCard>
          <ReportCard title="Clicks by button">
            <Rows
              empty="No clicks yet."
              head={["Button", "Clicks"]}
              rows={
                // Custom HTML records one click per view, with no button to tell apart.
                campaign.template === "html"
                  ? [["Each button", "—"]]
                  : report.buttons.map((b) => [
                      b.button_id === null
                        ? "Tap on the message"
                        : (labels.get(b.button_id) ?? b.button_id),
                      b.clicks,
                    ])
              }
            />
          </ReportCard>
        </div>
      )}
    </>
  );
}

// The numbers of a report that is on its way, in the places they will take.
function NumbersSkeleton({ campaign }: { campaign: InAppCampaign }) {
  const question = campaign.content.question;
  const table = (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
  return (
    <div aria-busy="true" aria-label="Loading results" className="space-y-4">
      {question && (
        <>
          <AnswersSkeleton
            rows={question.type === "stars" ? 5 : question.options.length}
            stars={question.type === "stars"}
          />
          <h3 className="pt-2 text-sm font-semibold">Results</h3>
        </>
      )}
      <div className={question ? ASKED_GRID : CARDS_GRID}>
        {ASKED_CARD.map((span, i) => (
          <StatSkeleton key={i} className={question ? span : undefined} />
        ))}
      </div>
      <ReportCard title="Over time">
        <Skeleton className="h-[220px] w-full" />
      </ReportCard>
      {question ? (
        <ReportCard title="By platform">{table}</ReportCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportCard title="By platform">{table}</ReportCard>
          <ReportCard title="Clicks by button">{table}</ReportCard>
        </div>
      )}
    </div>
  );
}

// Same shape as the loaded page, so nothing moves when the campaign arrives.
function ReportSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading in-app message"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex h-7 items-center gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="my-[3px] h-[13.5px] w-60" />
        </div>
        <div className="flex flex-wrap gap-2">
          {["w-[76px]", "w-[112px]", "w-[92px]", "w-[72px]"].map((w) => (
            <Skeleton key={w} className={cn("h-9", w)} />
          ))}
        </div>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-[180px]" />
          </div>
          <div className={CARDS_GRID}>
            {ASKED_CARD.map((_, i) => (
              <StatSkeleton key={i} />
            ))}
          </div>
          <div className="rounded-md border border-sidebar-border bg-muted/50 p-4 dark:bg-card">
            <Skeleton className="mb-6 mt-2 h-4 w-20" />
            <Skeleton className="h-[220px] w-full" />
          </div>
        </div>
        <aside className="rounded-lg border border-sidebar-border bg-sidebar p-4">
          <Skeleton className="mb-3.5 mt-0.5 h-4 w-20" />
          <PreviewSkeleton />
        </aside>
      </div>
    </div>
  );
}

function Workspace({
  campaignId,
  projectId,
}: PushContext & { campaignId: string }) {
  const router = useRouter();
  const query = useInAppCampaignQuery(projectId, campaignId);
  const audience = useInAppAudienceUpdate(projectId);
  const stale = query.data?.audience.segment_changed === true;
  const { refetch } = query;
  const { isSuccess: updating, reset: forget } = audience;
  // The update runs in a job: ask until the campaign shows it, and offer the button again if it never does.
  useEffect(() => {
    if (!updating) return;
    if (!stale) return forget();
    const ask = setInterval(() => void refetch(), 5_000);
    const giveUp = setTimeout(forget, 180_000);
    return () => {
      clearInterval(ask);
      clearTimeout(giveUp);
    };
  }, [updating, stale, refetch, forget]);
  const segments = useSegmentsQuery(projectId, false);
  const settings = useInAppSettingsQuery(projectId);
  const [range, setRange] = useState<Range>("30");
  const [editing, setEditing] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  // Which variant the Message panel draws; A by default.
  const [variant, setVariant] = useState<VariantKey>("a");
  const updateAudience = async (id: string) => {
    try {
      await audience.mutateAsync(id);
      showSuccessNotification(
        "The new audience is being calculated. The campaign keeps running."
      );
    } catch (e) {
      showErrorNotification(
        inAppErrorText(e, "Could not update the audience.")
      );
    }
  };
  const actions = useInAppCampaignActions(
    projectId,
    (id) => setEditing({ open: true, id }),
    () => router.push("/in_app")
  );
  const params = useMemo(() => reportRange(Number(range), new Date()), [range]);
  const campaign = query.data;
  const reported = !!campaign && campaign.launched_at !== null;
  const report = useInAppReportQuery(projectId, campaignId, params, reported);

  if (query.isPending) return <ReportSkeleton />;

  if (query.isError || !campaign) {
    if (isInAppNotEnabled(query.error))
      return (
        <p className="text-sm text-muted-foreground">
          In-app messages are not enabled for this project.
        </p>
      );
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-destructive">
          {query.error instanceof ApiError && query.error.status === 404
            ? "This in-app message could not be found."
            : inAppErrorText(
                query.error,
                "Could not load this in-app message."
              )}
        </p>
        <Button variant="outline" onClick={() => router.push("/in_app")}>
          Back to in-app messages
        </Button>
      </div>
    );
  }

  const draft = draftFromCampaign(campaign);
  const segmentName =
    segments.data?.segments.find((s) => s.id === campaign.audience.segment_id)
      ?.name ?? null;
  const failure = failureText(campaign.failure_reason);
  // The server refuses every change to a journey's message outside its journey.
  const inJourney = campaign.audience.type === "journey";
  const mayEdit = !inJourney && canEdit(campaign);
  // The server answers 422 for a campaign with nothing to compare.
  const experiment =
    campaign.control_group !== null ||
    campaign.conversion !== null ||
    (campaign.variants?.length ?? 0) > 0 ||
    (settings.data?.control_group ?? 0) > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{campaign.name}</h2>
            <InAppStatusPill status={campaign.status} />
          </div>
          <p className="text-[13px] text-muted-foreground">
            {campaign.launched_at
              ? `Launched ${format(new Date(campaign.launched_at), "d MMM yyyy, HH:mm")}, revision ${campaign.revision}`
              : "Not launched yet"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mayEdit && (
            <Button
              variant="outline"
              onClick={() => setEditing({ open: true, id: campaign.id })}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
          )}
          {!inJourney && (
            <Button
              variant="outline"
              onClick={() => void actions.duplicate(campaign)}
            >
              <Copy className="size-4" />
              Duplicate
            </Button>
          )}
          {!inJourney && canPause(campaign) && (
            <Button
              variant="outline"
              onClick={() => actions.step(campaign, "pause")}
            >
              <Pause className="size-4" />
              Pause
            </Button>
          )}
          {!inJourney && canResume(campaign) && (
            <Button onClick={() => actions.step(campaign, "resume")}>
              <Play className="size-4" />
              Resume
            </Button>
          )}
          {!inJourney && canEnd(campaign) && (
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => actions.step(campaign, "end")}
            >
              <CircleStop className="size-4" />
              End
            </Button>
          )}
        </div>
      </div>

      {experiment && reported && (
        <InAppExperimentBanner
          projectId={projectId}
          campaign={campaign}
          period={{ from: params.from, to: params.to }}
          onDuplicated={(id) => setEditing({ open: true, id })}
        />
      )}
      {failure && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-[13px]"
        >
          {failure}
        </p>
      )}
      {campaign.status === "preparing" && (
        <p
          role="status"
          className="rounded-md border border-sidebar-border bg-muted/50 p-3 text-[13px]"
        >
          The audience is being calculated. The campaign goes live by itself
          when that is done.
        </p>
      )}
      {inJourney && (
        <p
          role="status"
          className="rounded-md border border-sidebar-border bg-muted/50 p-3 text-[13px]"
        >
          This message is a step of a journey. Edit, pause or end it from that
          journey.
        </p>
      )}
      {!inJourney &&
        campaign.audience.segment_changed &&
        campaign.status !== "ended" && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-3 rounded-md border border-sidebar-border bg-muted/50 p-3 text-[13px]"
          >
            <p className="min-w-0 flex-1">
              The segment was edited after this campaign was launched. The
              campaign still uses the segment as it was.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={audience.isPending || audience.isSuccess}
              onClick={() => void updateAudience(campaign.id)}
            >
              {audience.isSuccess ? "Updating…" : "Update audience"}
            </Button>
          </div>
        )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {reported && (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">
                  {campaign.content.question ? "Answers" : "Results"}
                </h3>
                <div className="flex items-center gap-2">
                  {campaign.content.question && (
                    <InAppExportButton
                      projectId={projectId}
                      campaign={campaign}
                      period={{ from: params.from, to: params.to }}
                      count={report.data?.answers?.count}
                    />
                  )}
                  <Choice
                    label="Period"
                    className="w-[180px]"
                    value={range}
                    options={RANGES}
                    onChange={setRange}
                  />
                </div>
              </div>
              {report.isPending ? (
                <NumbersSkeleton campaign={campaign} />
              ) : report.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {inAppErrorText(report.error, "Could not load the results.")}
                </p>
              ) : (
                <>
                  {report.data.answers && (
                    <InAppAnswers
                      projectId={projectId}
                      campaignId={campaign.id}
                      period={{ from: params.from, to: params.to }}
                      answers={report.data.answers}
                    />
                  )}
                  {campaign.content.question && (
                    <h3 className="pt-2 text-sm font-semibold">Results</h3>
                  )}
                  <Numbers
                    campaign={campaign}
                    report={report.data}
                    experiment={
                      experiment && (
                        <InAppExperimentCard
                          projectId={projectId}
                          campaign={campaign}
                          period={{ from: params.from, to: params.to }}
                          audience={report.data.eligible_devices}
                          onDuplicated={(id) => setEditing({ open: true, id })}
                        />
                      )
                    }
                  />
                </>
              )}
            </section>
          )}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Setup</h3>
            <InAppSummary
              draft={draft}
              segmentName={segmentName}
              projectControlGroup={settings.data?.control_group ?? 0}
              audience={report.data?.eligible_devices}
            />
          </section>
        </div>
        <aside className="rounded-lg border border-sidebar-border bg-sidebar p-4 xl:sticky xl:top-0">
          <h3 className="mb-3 text-sm font-semibold">Message</h3>
          <PreviewPanel
            draft={withVariant(draft, variant)}
            header={
              draft.variants.length > 0 ? (
                <VariantBar
                  compact
                  variants={[
                    { id: "a", title: draft.title },
                    ...draft.variants.map((v) => ({
                      id: v.id,
                      title: v.content.title,
                    })),
                  ]}
                  selected={
                    draft.variants.some((v) => v.id === variant) ||
                    variant === "a"
                      ? variant
                      : "a"
                  }
                  onSelect={setVariant}
                />
              ) : undefined
            }
          />
        </aside>
      </div>

      <InAppCampaignDialog
        open={editing.open}
        onOpenChange={(open) => setEditing((e) => ({ ...e, open }))}
        projectId={projectId}
        campaignId={editing.id}
      />
      <ActionConfirm {...actions.confirm} />
    </div>
  );
}

export default function InAppReportPage({
  campaignId,
}: {
  campaignId: string;
}) {
  return (
    <PushShell title="Details" noun="in-app messages">
      {(ctx) => <Workspace {...ctx} campaignId={campaignId} />}
    </PushShell>
  );
}
