"use client";
import { CircleCheck } from "lucide-react";
import { OverviewPanelEmpty } from "@/components/analytics/overview/OverviewPanelEmpty";
import { errorCountHint, errorCountLabel } from "@ee/lib/push";
import type { PushCampaign } from "@ee/types/push";
import ReportCard from "./ReportCard";

// Ranked like the dashboard's Top links.
export default function FailuresTable({
  errorCounts,
  className,
}: {
  errorCounts: PushCampaign["report"]["error_counts"];
  className?: string;
}) {
  const rows = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((sum, [, count]) => sum + count, 0);
  const max = rows[0]?.[1] ?? 0;
  return (
    <ReportCard
      title="Failures by reason"
      className={className}
      aside={
        total > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {total.toLocaleString()} failed
          </span>
        )
      }
    >
      {rows.length === 0 ? (
        <OverviewPanelEmpty
          icon={CircleCheck}
          title="No delivery failures"
          description="Apple and Google accepted every notification that was sent."
        />
      ) : (
        <ol className="flex flex-col gap-3.5">
          {rows.map(([key, count], i) => {
            const hint = errorCountHint(key);
            return (
              <li key={key} className="flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2.5 text-[12.5px]">
                  <span className="flex min-w-0 items-start gap-2.5">
                    <span className="flex size-[18px] shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
                      <span className="font-medium">
                        {errorCountLabel(key)}
                      </span>
                      {hint && (
                        <span className="text-[11.5px] text-muted-foreground">
                          {hint}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 pt-0.5 font-semibold tabular-nums">
                    {count.toLocaleString()}
                  </span>
                </div>
                <div className="ml-[28px] h-[5px] overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-destructive/60"
                    style={{ width: `${max > 0 ? (count / max) * 100 : 0}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </ReportCard>
  );
}
