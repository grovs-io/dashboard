"use client";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrencyFromCents } from "@/utils/formatCurrency";
import { clickRate } from "@ee/lib/inApp";
import {
  VARIANT_LABELS,
  goalLabel,
  type VariantKey,
} from "@ee/lib/inAppComposer";
import ReportCard from "@ee/components/push/ReportCard";
import SplitOverview from "./SplitOverview";
import type {
  Experiment,
  ExperimentGroup,
  ExperimentGroupId,
} from "@ee/types/experiment";

const ORDER: ExperimentGroupId[] = [
  "a",
  "b",
  "c",
  "control",
  "project_control",
];
const GROUP_LABELS: Record<ExperimentGroupId, string> = {
  ...VARIANT_LABELS,
  control: "Control group",
  project_control: "Project control group",
};
const NONE = "—";

const percent = (share: number) => `${Math.round(share * 100)}%`;
const money = (cents: number) => formatCurrencyFromCents(cents, "en-US");
const wholeMoney = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);

export const variantOf = (id: ExperimentGroupId): VariantKey | null =>
  id === "a" || id === "b" || id === "c" ? id : null;

// One sentence that says what the numbers mean, chosen by what there is.
export function experimentSentence(
  experiment: Experiment,
  editable: boolean,
  subject = "Variants"
): string | null {
  if (!experiment.goal)
    return editable
      ? "Set a goal in the Experiment step to measure conversions."
      : "No goal was set.";
  if (experiment.control_group === null) return null;
  const { lift, added_conversions, more_people_needed } = experiment;
  // The test is one-sided (variants beat the control): a negative lift is sure when its complement is.
  const confidence =
    experiment.confidence === null
      ? null
      : lift !== null && lift < 0
        ? 1 - experiment.confidence
        : experiment.confidence;
  if (confidence !== null && confidence >= 0.95 && lift !== null) {
    const added = (added_conversions ?? 0).toLocaleString();
    return lift < 0
      ? `${subject} convert ${percent(-lift)} worse than the control: about ${added} conversions (${percent(confidence)} confidence).`
      : `${subject} convert ${percent(lift)} better than the control: about +${added} conversions (${percent(confidence)} confidence).`;
  }
  // No lift to quote when the control converted nobody; the added conversions still say it.
  if (
    confidence !== null &&
    confidence >= 0.95 &&
    lift === null &&
    (added_conversions ?? 0) > 0
  )
    return `The message brought about +${added_conversions!.toLocaleString()} conversions; the control converted nobody (${percent(confidence)} confidence).`;
  if (more_people_needed !== null && more_people_needed > 0)
    return `Not enough people yet for a clear answer: about ${more_people_needed.toLocaleString()} more per group.`;
  return "Not enough people yet for a clear answer.";
}

// The money the variants brought against the control, when there is a control to compare with.
export function revenueSentence(
  experiment: Experiment,
  subject = "Variants"
): string | null {
  const added = experiment.added_revenue_cents;
  if (added == null || Math.round(Math.abs(added) / 100) === 0) return null;
  const lift = experiment.revenue_lift;
  const share =
    lift == null
      ? ""
      : ` (${lift < 0 ? "−" : "+"}${percent(Math.abs(lift))} per person)`;
  return `${subject} brought about ${wholeMoney(Math.abs(added))} ${added < 0 ? "less" : "more"} than the control${share}.`;
}

const perPerson = (g: ExperimentGroup) => g.revenue_cents / g.exposed;
const byConversion = (x: ExperimentGroup, y: ExperimentGroup) =>
  (y.conversion_rate ?? 0) - (x.conversion_rate ?? 0);

// Exposed groups ordered by who's winning, by revenue then by conversion; null without either signal.
function leaderOrder(experiment: Experiment): ExperimentGroup[] | null {
  const groups = experiment.groups.filter((g) => g.exposed > 0);
  if (groups.length < 2) return null;
  // Unrounded: 0.51 and 1.49 cents per person both round to 1.
  if (groups.some((g) => g.revenue_cents > 0))
    return [...groups].sort((x, y) => perPerson(y) - perPerson(x));
  if (experiment.goal) return [...groups].sort(byConversion);
  return null;
}

// How sure the leader converts better than path A, or, when A leads, than every other path.
export function pathConfidence(experiment: Experiment): number | null {
  const order = leaderOrder(experiment);
  if (!order || !experiment.goal) return null;
  const [leader, ...rest] = order as [ExperimentGroup, ...ExperimentGroup[]];
  if (leader.id !== "a") return leader.confidence;
  const others = rest.map((g) => g.confidence);
  if (others.some((c) => c === null)) return null;
  return 1 - Math.max(...(others as number[]));
}

// Whether "send everyone down the leader" rests on a clear result: sure conversions that agree with the ranking.
export function pathLeaderIsClear(experiment: Experiment): boolean {
  const order = leaderOrder(experiment);
  const confidence = pathConfidence(experiment);
  if (!order || confidence === null || confidence < 0.95) return false;
  // Confidence only exists against path A, so a third path close behind the leader can't be ruled out.
  if (order[0]?.id !== "a" && order.length > 2) return false;
  const best = [...order].sort(byConversion)[0];
  return best?.id === order[0]?.id;
}

// The id of the group leading a path experiment, by the same rule pathLeaderSentence explains.
export function pathLeader(experiment: Experiment): ExperimentGroupId | null {
  return leaderOrder(experiment)?.[0]?.id ?? null;
}

// For journeys' per-path A/B cards: which path is winning, and by how much.
export function pathLeaderSentence(
  experiment: Experiment,
  labels: Partial<Record<ExperimentGroupId, string>> = {}
): string | null {
  const order = leaderOrder(experiment);
  if (!order) return null;
  const [leader, runnerUp] = order as [ExperimentGroup, ExperimentGroup];
  const groups = experiment.groups.filter((g) => g.exposed > 0);
  const label = (g: ExperimentGroup) => labels[g.id] ?? GROUP_LABELS[g.id];
  const aGroup = groups.find((g) => g.id === "a") ?? null;
  // Path A is the usual baseline; the only exception is when A itself is the leader.
  const other = leader.id !== "a" && aGroup ? aGroup : runnerUp;
  const confidence = pathConfidence(experiment);

  if (groups.some((g) => g.revenue_cents > 0)) {
    const leaderRpp = leader.revenue_per_person_cents ?? 0;
    const otherRpp = perPerson(other);
    // A 0 comparison base has no ratio to quote — say it plainly instead of "+0%" (reads as a tie).
    if (otherRpp <= 0)
      return `${label(leader)} earned the most: ${money(leaderRpp)} per person; ${label(other)} earned nothing.`;
    const lift = (perPerson(leader) - otherRpp) / otherRpp;
    return `${label(leader)} earned the most: ${money(leaderRpp)} per person, +${Math.round(lift * 100)}% vs ${label(other)}.`;
  }

  const sure =
    confidence === null ? "" : ` (${percent(confidence)} confidence)`;
  return `${label(leader)} converted best: ${percent(leader.conversion_rate ?? 0)} vs ${percent(other.conversion_rate ?? 0)} for ${label(other)}${sure}.`;
}

export function ExperimentSkeleton() {
  return (
    <ReportCard title="Experiment">
      <div
        aria-busy="true"
        aria-label="Loading experiment"
        className="space-y-3"
      >
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    </ReportCard>
  );
}

// A count over its rate, so a cell stays narrow.
function Counted({
  count,
  rate,
}: {
  count: number | null;
  rate: number | null;
}) {
  if (count === null || rate === null) return <>{NONE}</>;
  return (
    <>
      {count.toLocaleString()}
      <span className="block text-xs text-muted-foreground">
        {clickRate(rate)}
      </span>
    </>
  );
}

const num = "px-3 py-2 text-right align-top tabular-nums";

interface Props {
  query: {
    isPending: boolean;
    isError: boolean;
    error: unknown;
    data: Experiment | undefined;
  };
  errorText: (error: unknown) => string;
  // "Clicked" for in-app, "Opened" for push; null drops the column.
  clickedLabel: string | null;
  // Whether a goal can still be set, for the sentence without one.
  editable: boolean;
  // Devices or people, when known: the split shows counts too.
  audience?: number | null;
  // What a variant row can do, if anything; the dialogs it opens go in `children`.
  action?: (variant: VariantKey) => ReactNode;
  children?: ReactNode;
  // Journeys: their own group names and goal line, and no window.
  groupLabels?: Partial<Record<ExperimentGroupId, string>>;
  goalText?: string;
  subject?: string;
  // Journeys' A/B split cards name the split instead of the generic default.
  title?: string;
  // Journeys' A/B split cards show their own leader sentence via `children` instead.
  hideBuiltInSentence?: boolean;
}

export default function ExperimentCard({
  query,
  errorText,
  clickedLabel,
  editable,
  audience,
  action,
  children,
  groupLabels,
  goalText,
  subject,
  title = "Experiment",
  hideBuiltInSentence = false,
}: Props) {
  if (query.isPending) return <ExperimentSkeleton />;
  if (query.isError || !query.data)
    return (
      <ReportCard title={title}>
        <p role="alert" className="text-sm text-destructive">
          {errorText(query.error)}
        </p>
      </ReportCard>
    );

  const experiment = query.data;
  const goal = experiment.goal;
  const rows = ORDER.map((id) =>
    experiment.groups.find((g) => g.id === id)
  ).filter((g): g is ExperimentGroup => !!g);
  const sentence = hideBuiltInSentence
    ? null
    : experimentSentence(experiment, editable, subject);
  const revenue = revenueSentence(experiment, subject);
  // Apps without purchases would see a column of zeros; older reports send no revenue at all.
  const showRevenue =
    goal?.purchase === true ||
    experiment.groups.some((g) => (g.revenue_cents ?? 0) !== 0);
  const head = "px-3 pb-2 text-right align-bottom font-medium";
  const a = experiment.groups.find((g) => g.id === "a");
  const rateOf = (g: ExperimentGroup) =>
    goal ? g.conversion_rate : g.click_rate;
  // `confidence` is P(variant beats A): shown the way the difference points.
  const confidenceOf = (g: ExperimentGroup) => {
    if (g.confidence === null) return NONE;
    const mine = rateOf(g);
    const theirs = a ? rateOf(a) : null;
    if (mine !== null && theirs !== null && mine < theirs)
      return (
        <>
          {percent(1 - g.confidence)}
          <span className="ml-1 text-xs text-muted-foreground">worse</span>
        </>
      );
    return percent(g.confidence);
  };

  return (
    <ReportCard
      title={title}
      aside={
        <span className="text-xs text-muted-foreground">
          {goalText ?? (goal ? `Goal: ${goalLabel(goal)}` : "No goal")}
        </span>
      }
    >
      <SplitOverview
        className="mb-4"
        controlGroup={experiment.control_group}
        variants={
          experiment.groups.filter((g) => g.id === "b" || g.id === "c").length
        }
        projectControlGroup={experiment.project_control_group}
        audience={audience}
        labels={groupLabels}
      />
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-3 pb-2 align-bottom font-medium">Group</th>
              <th className={head}>People</th>
              {clickedLabel && <th className={head}>{clickedLabel}</th>}
              {goal && <th className={head}>Converted</th>}
              {showRevenue && <th className={head}>Revenue</th>}
              {showRevenue && <th className={head}>Per person</th>}
              <th className={head}>
                Confidence
                <span className="block font-normal text-muted-foreground/70">
                  vs A
                </span>
              </th>
              {action && <th className="px-3 pb-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((group) => {
              const variant = variantOf(group.id);
              return (
                <tr key={group.id} className="border-t border-sidebar-border">
                  <td className="px-3 py-2 align-top">
                    {groupLabels?.[group.id] ?? GROUP_LABELS[group.id]}
                  </td>
                  <td className={num}>{group.exposed.toLocaleString()}</td>
                  {clickedLabel && (
                    <td className={num}>
                      <Counted count={group.clicked} rate={group.click_rate} />
                    </td>
                  )}
                  {goal && (
                    <td className={num}>
                      <Counted
                        count={group.converted}
                        rate={group.conversion_rate}
                      />
                    </td>
                  )}
                  {showRevenue && (
                    <td className={num}>{money(group.revenue_cents)}</td>
                  )}
                  {showRevenue && (
                    <td className={num}>
                      {group.revenue_per_person_cents == null
                        ? NONE
                        : money(group.revenue_per_person_cents)}
                    </td>
                  )}
                  <td className={num}>{confidenceOf(group)}</td>
                  {action && (
                    <td className={cn(num, "py-1.5 whitespace-nowrap")}>
                      {variant && action(variant)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sentence && (
        <p className="mt-4 text-[13px] text-muted-foreground">{sentence}</p>
      )}
      {revenue && (
        <p className="mt-2 text-[13px] text-muted-foreground">{revenue}</p>
      )}
      {children}
    </ReportCard>
  );
}
