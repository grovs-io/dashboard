"use client";

import { Share2 } from "lucide-react";
import { OverviewPanelEmpty } from "./OverviewPanelEmpty";
import { Skeleton } from "@/components/ui/skeleton";
import type { MetricsOverview } from "@/types";

const CHANNELS = [
  { key: "link_driven_installs", label: "Link-driven" },
  { key: "organic_users", label: "Organic" },
  { key: "referred_users", label: "Referred" },
] as const;

const numberFormatter = new Intl.NumberFormat("de-DE");

/** "Where users came from" channel split, from the real dashboard metrics. */
export function AcquisitionChannels({
  metrics,
  loading,
}: {
  metrics: MetricsOverview["current"] | undefined;
  loading?: boolean;
}) {
  const rows = CHANNELS.map((c) => ({ ...c, value: metrics?.[c.key] ?? 0 }));
  const total = rows.reduce((sum, r) => sum + r.value, 0);

  return (
    <div className="rounded-md border border-sidebar-border bg-muted/50 p-4 dark:bg-card">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium">Channels</span>
        {!loading && total > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {numberFormatter.format(total)} users
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {CHANNELS.map((channel, i) => (
            <div key={channel.key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-14" />
              </div>
              <Skeleton
                className="h-1.5 rounded-full"
                style={{ width: `${92 - i * 14}%` }}
              />
            </div>
          ))}
        </div>
      ) : total === 0 ? (
        <OverviewPanelEmpty
          icon={Share2}
          title="No installs in this period"
          description="Channels break down where your installs came from. No installs were recorded in the selected date range."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => {
            const p = total > 0 ? Math.round((r.value / total) * 100) : 0;
            return (
              <div key={r.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-semibold tabular-nums">
                    {numberFormatter.format(r.value)}
                    <span className="ml-1 font-normal text-muted-foreground">
                      {p}%
                    </span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--chart-users)]"
                    style={{ width: `${p}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
