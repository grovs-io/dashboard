"use client";
import { IncompleteBadge } from "@ee/components/segments/SegmentNotices";
import { failureReasonHint, failureReasonLabel } from "@ee/lib/push";
import { cn } from "@/lib/utils";
import type { PushCampaign } from "@ee/types/push";

type ReportMetricKey =
  | "targeted"
  | "no_channel"
  | "not_found"
  | "cancelled"
  | "queued"
  | "delivered"
  | "failed"
  | "opened"
  | "held"
  | "waiting";

const METRICS: { key: ReportMetricKey; label: string; definition: string }[] = [
  {
    key: "targeted",
    label: "Targeted",
    definition: "Devices selected for this push.",
  },
  {
    key: "no_channel",
    label: "No channel",
    definition: "No push token on file.",
  },
  {
    key: "not_found",
    label: "Not found",
    definition: "Device no longer exists.",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    definition: "Not sent: the campaign was cancelled first.",
  },
  {
    key: "queued",
    label: "Queued",
    definition: "Handed to APNs / FCM, no result yet.",
  },
  {
    key: "delivered",
    label: "Delivered",
    definition: "Accepted by APNs / FCM.",
  },
  { key: "failed", label: "Failed", definition: "Rejected by APNs / FCM." },
  {
    key: "opened",
    label: "Opened",
    definition: "Tapped, reported by the SDK.",
  },
  {
    key: "held",
    label: "Control group",
    definition: "Kept back on purpose, to compare against.",
  },
  {
    key: "waiting",
    label: "Waiting for the winner",
    definition: "Outside the test share; sent once a variant is chosen.",
  },
];

const HEADLINE: ReportMetricKey[] = [
  "targeted",
  "delivered",
  "opened",
  "failed",
];
const BREAKDOWN: ReportMetricKey[] = [
  "queued",
  "no_channel",
  "not_found",
  "cancelled",
];
// Only shown when they count someone: most campaigns have no experiment.
const OPTIONAL: ReportMetricKey[] = ["held", "waiting"];
const byKey = new Map(METRICS.map((m) => [m.key, m]));

const rate = (n: number, of: number) =>
  of > 0 ? `${Math.round((n / of) * 100)}%` : null;

// Laid out like the dashboard's key-metrics card.
export default function ReachFunnel({ campaign }: { campaign: PushCampaign }) {
  const { report } = campaign;
  const breakdown = [
    ...BREAKDOWN,
    ...OPTIONAL.filter((key) => (report[key] ?? 0) > 0),
  ];
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-sidebar-border bg-background">
        <div className="flex flex-wrap gap-2.5 p-5">
          {HEADLINE.map((key) => {
            const metric = byKey.get(key)!;
            const share =
              key === "targeted" ? null : rate(report[key], report.targeted);
            return (
              <div
                key={key}
                title={metric.definition}
                className="flex min-w-[150px] flex-1 flex-col gap-1 rounded-[10px] border border-sidebar-border bg-background px-3 py-2"
              >
                <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      key === "failed"
                        ? "bg-destructive/70"
                        : key === "targeted"
                          ? "bg-muted-foreground/40"
                          : "bg-chart-users"
                    )}
                  />
                  {metric.label}
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold tabular-nums tracking-tight">
                    {report[key].toLocaleString()}
                  </span>
                  {share && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-muted-foreground">
                      {share}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        <dl className="grid grid-cols-2 divide-sidebar-border border-t border-sidebar-border sm:grid-cols-4 sm:divide-x">
          {breakdown.map((key) => {
            const metric = byKey.get(key)!;
            return (
              <div
                key={key}
                className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 px-5 py-3"
              >
                <dt className="text-[12.5px] text-muted-foreground">
                  {metric.label}
                </dt>
                <dd className="text-[12.5px] font-semibold tabular-nums">
                  {report[key].toLocaleString()}
                </dd>
                <dd className="col-span-2 text-[11.5px] text-muted-foreground/70">
                  {metric.definition}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
      {report.audience.incomplete && (
        <p>
          <IncompleteBadge />
        </p>
      )}
      {campaign.status === "failed" && campaign.failure_reason && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
        >
          <p className="font-medium">
            {failureReasonLabel(campaign.failure_reason)}
          </p>
          <p className="text-muted-foreground">
            {failureReasonHint(campaign.failure_reason)}
          </p>
        </div>
      )}
    </div>
  );
}
