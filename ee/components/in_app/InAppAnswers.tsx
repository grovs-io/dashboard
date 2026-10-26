"use client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import ReportCard from "@ee/components/push/ReportCard";
import type { InAppAnswers as Answers } from "@ee/types/inApp";
import InAppComments, {
  CommentSkeletons,
  WAITING_LIST,
  starsText,
} from "./InAppComments";

const GRID = "grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]";

const percent = (count: number, total: number) =>
  total > 0 ? `${Math.round((count / total) * 100)}%` : "0%";

// The bars and the comments of a report that is on its way.
export function AnswersSkeleton({
  rows,
  stars,
}: {
  rows: number;
  stars: boolean;
}) {
  return (
    <div className={GRID}>
      <ReportCard
        title="What people answered"
        aside={stars && <Skeleton className="h-4 w-36" />}
      >
        <ul className="space-y-3">
          {Array.from({ length: rows }, (_, i) => (
            <li key={i} className="space-y-1.5">
              <div className="flex h-[19.5px] items-center justify-between">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3.5 w-14" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </li>
          ))}
        </ul>
      </ReportCard>
      <ReportCard
        title="Comments"
        aside={<Skeleton className="h-9 w-full sm:w-[180px]" />}
      >
        <ul className={WAITING_LIST}>
          <CommentSkeletons count={4} stars={stars} />
        </ul>
      </ReportCard>
    </div>
  );
}

export default function InAppAnswers({
  projectId,
  campaignId,
  period,
  answers,
}: {
  projectId: string;
  campaignId: string;
  period: { from: string; to: string };
  answers: Answers;
}) {
  const { type, count, score, values } = answers;
  const max = Math.max(...values.map((v) => v.count), 0);
  // A choice removed after launch: its answers still count, under its id.
  const removed = (v: Answers["values"][number]) =>
    type === "choice" && v.label === String(v.value);
  return (
    <div className={GRID}>
      <ReportCard
        title="What people answered"
        aside={
          score !== null && (
            <p className="text-xs text-muted-foreground">
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {score.toFixed(1)}
              </span>{" "}
              out of 5 on average
            </p>
          )
        }
      >
        <ul className="space-y-3">
          {values.map((v) => (
            <li key={v.value} className="space-y-1.5 text-[13px]">
              <div className="flex items-baseline justify-between gap-3">
                <span
                  title={removed(v) ? "This choice was removed" : undefined}
                  className={cn(
                    "min-w-0 [overflow-wrap:anywhere]",
                    removed(v) && "text-muted-foreground"
                  )}
                >
                  {type === "stars" ? starsText(v.value) : v.label}
                </span>
                <span className="flex shrink-0 gap-1.5 tabular-nums">
                  <span className="font-semibold">
                    {v.count.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">
                    {percent(v.count, count)}
                  </span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  data-testid="in-app-answer-bar"
                  className="h-full rounded-full bg-[var(--chart-users)]"
                  style={{
                    width: `${max > 0 ? Math.round((v.count / max) * 100) : 0}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </ReportCard>
      <InAppComments
        projectId={projectId}
        campaignId={campaignId}
        period={period}
        answers={answers}
      />
    </div>
  );
}
