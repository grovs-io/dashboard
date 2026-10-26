"use client";
import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CircleStop, Copy, Pause, Pencil, Play, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ActionConfirm from "@/components/common/action-confirm";
import { ApiError } from "@/lib/ApiError";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import { cn } from "@/lib/utils";
import { reportRange } from "@ee/app/in_app/InAppReportPage";
import { clickRate } from "@ee/lib/inApp";
import { goalSubject } from "@ee/lib/inAppComposer";
import ExperimentCard, {
  ExperimentSkeleton,
  pathLeader,
  pathLeaderIsClear,
  pathLeaderSentence,
} from "@ee/components/experiments/ExperimentCard";
import { Choice } from "@/components/composer/fields";
import Stat, { StatSkeleton } from "@/components/composer/Stat";
import JourneyDialog from "@ee/components/journeys/JourneyDialog";
import JourneyMap from "@ee/components/journeys/JourneyMap";
import JourneyStatusPill from "@ee/components/journeys/JourneyStatusPill";
import JourneySetup from "@ee/components/journeys/report/JourneySetup";
import JourneyStatusBanner from "@ee/components/journeys/report/JourneyStatusBanner";
import JourneyStepsTable from "@ee/components/journeys/report/JourneyStepsTable";
import ReportCard from "@ee/components/push/ReportCard";
import { useSaveJourney } from "@ee/hooks/mutations/useJourneyMutations";
import {
  useJourneyQuery,
  useJourneyReportQuery,
} from "@ee/hooks/queries/useJourneyQueries";
import { useInAppSettingsQuery } from "@ee/hooks/queries/useInAppQueries";
import { useSegmentsQuery } from "@ee/hooks/queries/useSegmentsQueries";
import { useJourneyActions } from "@ee/hooks/useJourneyActions";
import {
  canEdit,
  canEnd,
  canPause,
  canResume,
  entryLabel,
  eventLabel,
  isJourneysNotEnabled,
  journeyErrorText,
  pathGroupLabels,
  stepOrder,
  stepSummary,
  stepsInput,
  type JourneyFocus,
} from "@ee/lib/journeys";
import PushShell, { type PushContext } from "@ee/app/push/PushShell";
import type { Conversion, ExperimentGroupId } from "@ee/types/experiment";
import type { Journey, JourneyReport } from "@ee/types/journey";

const RANGES = [
  { value: "1", label: "Today (UTC)" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;
type Range = (typeof RANGES)[number]["value"];

const goalName = (g: Conversion) =>
  goalSubject(g).replace(/^the (.*) screen$/, "$1");

// The report measures the first goal; the others still take people out.
export function goalText(goals: Conversion[]): string {
  const [first, ...rest] = goals.map(goalName);
  return `Goal: ${first ?? "none"}${
    rest.length ? ` · also counts: ${rest.join(", ")}` : ""
  }`;
}

// "started on App installed": the entry in a few words.
const startedOn = (
  journey: Journey,
  segmentName: (id: string) => string | null
) =>
  journey.entry.type === "segment"
    ? `joining ${(journey.entry.segment_id && segmentName(journey.entry.segment_id)) || "a segment"}`
    : eventLabel(journey.entry.event);

const GRID = "grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5";
const n = (v: number) => v.toLocaleString();

// A path group id is one of the paths' own a/b/c order, never a control group.
const PATH_INDEX: Partial<Record<ExperimentGroupId, number>> = {
  a: 0,
  b: 1,
  c: 2,
};

interface SendAsk {
  stepId: string;
  pathIndex: number;
  leaderId: ExperimentGroupId;
  label: string;
  lowConfidence: boolean;
}

// An A/B split card per percent-split step with path results and at least one exposed person.
function PathCards({
  journey,
  data,
  segmentName,
  projectId,
}: {
  journey: Journey;
  data: JourneyReport;
  segmentName: (id: string) => string | null;
  projectId: string;
}) {
  const save = useSaveJourney(projectId);
  const [asking, setAsking] = useState<SendAsk | null>(null);

  const confirmSend = async () => {
    if (!asking) return;
    const step = journey.steps[asking.stepId];
    if (!step || step.type !== "split" || step.mode !== "percent") return;
    const updatedStep = {
      ...step,
      paths: step.paths.map((p, i) => ({
        ...p,
        percent: i === asking.pathIndex ? 100 : 0,
      })),
    };
    try {
      await save.mutateAsync({
        id: journey.id,
        input: {
          name: journey.name,
          steps: stepsInput({ ...journey.steps, [step.id]: updatedStep }),
          lock_version: journey.lock_version,
        },
      });
      // Report the split as it now stands (100%), not the percentage shown when the dialog opened.
      const freshLabel =
        pathGroupLabels(updatedStep)[asking.leaderId] ?? asking.label;
      showSuccessNotification(`Everyone now goes down ${freshLabel}.`);
    } catch (error) {
      showErrorNotification(
        journeyErrorText(error, "Could not save the journey.")
      );
    }
  };

  return (
    <>
      {stepOrder(journey).map((id) => {
        const step = journey.steps[id];
        const experiment = data.paths?.[id];
        if (
          !step ||
          step.type !== "split" ||
          step.mode !== "percent" ||
          !experiment ||
          !experiment.groups.some((g) => g.exposed > 0)
        )
          return null;
        const labels = pathGroupLabels(step);
        const sentence = pathLeaderSentence(experiment, labels);
        const leaderId = pathLeader(experiment);
        const leaderIndex = leaderId ? PATH_INDEX[leaderId] : undefined;
        const leaderLabel =
          leaderId && leaderIndex !== undefined ? labels[leaderId] : null;
        const leaderGroup = leaderId
          ? (experiment.groups.find((g) => g.id === leaderId) ?? null)
          : null;
        const alreadyFull =
          leaderIndex !== undefined && step.paths[leaderIndex]?.percent === 100;
        const canSend =
          canEnd(journey) && leaderIndex !== undefined && !alreadyFull;
        const showMuted = leaderIndex !== undefined && alreadyFull;
        const lowConfidence = !!leaderGroup && !pathLeaderIsClear(experiment);
        return (
          <ExperimentCard
            key={id}
            query={{
              isPending: false,
              isError: false,
              error: null,
              data: experiment,
            }}
            errorText={(e) => journeyErrorText(e, "Could not load this split.")}
            clickedLabel={null}
            editable={false}
            groupLabels={labels}
            goalText={goalText(journey.goals)}
            title={`A/B split · ${stepSummary(journey, step, segmentName)}`}
            hideBuiltInSentence
            action={
              canSend
                ? (variant) =>
                    variant === leaderId ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setAsking({
                            stepId: step.id,
                            pathIndex: leaderIndex!,
                            leaderId: leaderId!,
                            label: leaderLabel!,
                            lowConfidence,
                          })
                        }
                      >
                        Send everyone here
                      </Button>
                    ) : null
                : undefined
            }
          >
            {sentence && (
              <p className="mt-4 text-[13px] text-muted-foreground">
                {sentence}
              </p>
            )}
            {showMuted && (
              <p className="mt-2 text-[13px] text-muted-foreground">
                Everyone now goes down {leaderLabel}.
              </p>
            )}
          </ExperimentCard>
        );
      })}
      <ActionConfirm
        open={!!asking}
        setOpen={(open) => !open && setAsking(null)}
        title={`Send everyone down ${asking?.label ?? ""}?`}
        description={
          `People who reach this split from now on all take ${asking?.label ?? ""}. ` +
          "People already past it stay where they are. " +
          "You can change the percentages back in the editor." +
          (asking?.lowConfidence
            ? " There aren't enough people yet for a clear answer."
            : "")
        }
        confirmText="Send everyone"
        pendingText="Sending…"
        onConfirm={confirmSend}
      />
    </>
  );
}

function Tiles({ report }: { report: JourneyReport }) {
  const { left } = report;
  const reasons = [
    `${n(left.goal)} reached a goal`,
    `${n(left.finished)} finished`,
    `${n(left.expired)} over 90 days`,
  ];
  return (
    <div className={GRID}>
      <Stat label="Entered" value={n(report.entered)} hint="In the period" />
      <Stat label="In the journey now" value={n(report.active)} hint="Live" />
      <Stat
        label="Converted"
        value={n(left.goal)}
        hint={`${clickRate(report.entered ? left.goal / report.entered : 0)} of people in the journey`}
      />
      <Stat label="Held back" value={n(report.held)} hint="The control group" />
      <Stat
        className="col-span-2 md:col-span-1"
        label="Left"
        value={n(left.goal + left.finished + left.expired)}
        hint={reasons.join(" · ")}
      />
    </div>
  );
}

function TilesSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading results" className={GRID}>
      {[0, 1, 2, 3, 4].map((i) => (
        <StatSkeleton key={i} />
      ))}
    </div>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ReportSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading journey"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex h-7 items-center gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="my-[3px] h-[13.5px] w-80" />
        </div>
        <div className="flex gap-2">
          {["w-[76px]", "w-[112px]", "w-[92px]", "w-[72px]"].map((w) => (
            <Skeleton key={w} className={cn("h-9", w)} />
          ))}
        </div>
      </div>
      <Skeleton className="h-[46px] w-full rounded-md" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-9 w-[180px]" />
      </div>
      <TilesSkeleton />
      <ExperimentSkeleton />
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-[360px] w-full rounded-md" />
      <Skeleton className="h-4 w-14" />
      <Skeleton className="h-[300px] w-full rounded-lg" />
    </div>
  );
}

function Workspace({
  journeyId,
  projectId,
}: PushContext & { journeyId: string }) {
  const router = useRouter();
  const query = useJourneyQuery(projectId, journeyId);
  const segments = useSegmentsQuery(projectId, false);
  const settings = useInAppSettingsQuery(projectId);
  const [range, setRange] = useState<Range>("30");
  const [editing, setEditing] = useState<{
    open: boolean;
    id: string | null;
    focus?: JourneyFocus;
  }>({ open: false, id: null });
  const actions = useJourneyActions(
    projectId,
    (id) => setEditing({ open: true, id }),
    () => router.push("/journeys")
  );
  const params = useMemo(() => {
    const { from, to } = reportRange(Number(range), new Date());
    return { from, to };
  }, [range]);
  const journey = query.data;
  const reported = !!journey && journey.launched_at !== null;
  const report = useJourneyReportQuery(projectId, journeyId, params, reported);

  if (query.isPending) return <ReportSkeleton />;
  if (query.isError || !journey) {
    if (isJourneysNotEnabled(query.error))
      return (
        <p className="text-sm text-muted-foreground">
          Journeys are not enabled for this project.
        </p>
      );
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-destructive">
          {query.error instanceof ApiError && query.error.status === 404
            ? "This journey could not be found."
            : journeyErrorText(query.error, "Could not load this journey.")}
        </p>
        <Button variant="outline" onClick={() => router.push("/journeys")}>
          Back to journeys
        </Button>
      </div>
    );
  }

  const segmentName = (id: string) =>
    segments.data?.segments.find((s) => s.id === id)?.name ?? null;
  const mayEdit = canEdit(journey);
  const edit = (focus?: JourneyFocus) =>
    setEditing({ open: true, id: journey.id, focus });
  const data = report.data;
  const unavailable =
    report.error instanceof ApiError && report.error.status === 503;

  let results: ReactNode;
  if (report.isPending)
    results = (
      <>
        <TilesSkeleton />
        <ExperimentSkeleton />
      </>
    );
  else if (report.isError)
    results = (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-sidebar-border bg-muted/50 p-3 text-[13px]"
      >
        <p>
          {unavailable
            ? "The results cannot be read right now. Try again in a minute."
            : journeyErrorText(report.error, "Could not load the results.")}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void report.refetch()}
        >
          <RotateCw className="size-3.5" />
          Try again
        </Button>
      </div>
    );
  else if (data && data.entered + data.held === 0 && data.active === 0)
    results = (
      <div
        role="status"
        className="rounded-md border border-dashed border-sidebar-border p-8 text-center text-[13px] text-muted-foreground"
      >
        Nobody has entered yet. People enter{" "}
        {entryLabel(journey.entry, segmentName).replace(/^When/, "when")}.
      </div>
    );
  else if (data)
    results = (
      <>
        <Tiles report={data} />
        {data.goal && (
          <ExperimentCard
            query={{
              isPending: false,
              isError: false,
              error: null,
              data: data.goal,
            }}
            errorText={(e) => journeyErrorText(e, "Could not load the goal.")}
            clickedLabel={null}
            editable={false}
            audience={data.entered + data.held}
            groupLabels={{ a: "In the journey" }}
            goalText={goalText(journey.goals)}
            subject="People in the journey"
          />
        )}
        <PathCards
          journey={journey}
          data={data}
          segmentName={segmentName}
          projectId={projectId}
        />
      </>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{journey.name}</h2>
            <JourneyStatusPill status={journey.status} />
          </div>
          <p className="text-[13px] text-muted-foreground">
            {journey.launched_at
              ? `Launched ${format(new Date(journey.launched_at), "d MMM yyyy, HH:mm")} · revision ${journey.revision} · started on ${startedOn(journey, segmentName)}`
              : "Draft, never launched"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mayEdit && (
            <Button variant="outline" onClick={() => edit()}>
              <Pencil className="size-4" />
              Edit
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => void actions.duplicate(journey)}
          >
            <Copy className="size-4" />
            Duplicate
          </Button>
          {canPause(journey) && (
            <Button
              variant="outline"
              onClick={() => actions.step(journey, "pause")}
            >
              <Pause className="size-4" />
              Pause
            </Button>
          )}
          {canResume(journey) && (
            <Button onClick={() => actions.step(journey, "resume")}>
              <Play className="size-4" />
              Resume
            </Button>
          )}
          {canEnd(journey) && (
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => actions.step(journey, "end")}
            >
              <CircleStop className="size-4" />
              End
            </Button>
          )}
        </div>
      </div>

      <JourneyStatusBanner
        journey={journey}
        report={data}
        loading={reported && report.isPending}
        onResume={() => actions.step(journey, "resume")}
        onEdit={() => edit()}
      />

      {reported && (
        <Section
          title="Results"
          aside={
            <Choice
              label="Period"
              className="w-[180px]"
              value={range}
              options={RANGES}
              onChange={setRange}
            />
          }
        >
          {results}
        </Section>
      )}

      <Section
        title="Steps"
        aside={
          reported && (
            <span className="text-xs text-muted-foreground">
              Reached in the period; now is live
            </span>
          )
        }
      >
        <ReportCard title="Map">
          <div className="-mx-4 -mb-4 overflow-x-auto border-t border-sidebar-border bg-sidebar">
            <JourneyMap
              draft={journey}
              segmentName={segmentName}
              report={reported && data ? data : undefined}
            />
          </div>
        </ReportCard>
        {reported &&
          (report.isPending ? (
            <div
              aria-busy="true"
              aria-label="Loading steps"
              className="space-y-3"
            >
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            data && (
              <ReportCard title="By step">
                <JourneyStepsTable
                  journey={journey}
                  report={data}
                  segmentName={segmentName}
                />
              </ReportCard>
            )
          ))}
      </Section>

      <Section title="Setup">
        {segments.isPending || settings.isPending ? (
          <Skeleton
            aria-label="Loading setup"
            className="h-[300px] w-full rounded-lg"
          />
        ) : (
          <JourneySetup
            journey={journey}
            segmentName={segmentName}
            projectControlGroup={settings.data?.control_group ?? 0}
            onEdit={mayEdit ? edit : undefined}
          />
        )}
      </Section>

      <JourneyDialog
        open={editing.open}
        onOpenChange={(open) => setEditing((e) => ({ ...e, open }))}
        projectId={projectId}
        journeyId={editing.id}
        focus={editing.focus}
      />
      <ActionConfirm {...actions.confirm} />
    </div>
  );
}

export default function JourneyReportPage({
  journeyId,
}: {
  journeyId: string;
}) {
  return (
    <PushShell title="Details" noun="journeys">
      {(ctx) => <Workspace {...ctx} journeyId={journeyId} />}
    </PushShell>
  );
}
