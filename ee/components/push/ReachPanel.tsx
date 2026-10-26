"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformIcon } from "@/components/analytics/shared";
import { IncompleteBadge } from "@ee/components/segments/SegmentNotices";
import {
  PUSH_PLATFORMS,
  devicesWord,
  pushErrorMessage,
  reachCount,
} from "@ee/lib/push";
import { useAudienceEstimate } from "@ee/hooks/queries/usePushQueries";
import { audienceInput, audienceValid } from "@ee/lib/pushComposer";
import type { AudienceValue } from "@ee/types/audience";
import { cn } from "@/lib/utils";
import type { PushEstimate, PushPlatform } from "@ee/types/push";

export interface ReachPanelProps {
  projectId: string;
  audience: AudienceValue;
  onEstimate?: (estimate: PushEstimate | null) => void;
}

function Frame({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <section
      aria-label={label}
      className="rounded-lg bg-background p-3 shadow-sm ring-1 ring-sidebar-border dark:bg-muted"
    >
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Estimated reach
      </p>
      {children}
    </section>
  );
}

// A partial response shows a dash rather than crashing the card.
const count = (n: number | null | undefined) =>
  typeof n === "number" ? n.toLocaleString() : "—";

export default function ReachPanel({
  projectId,
  audience,
  onEstimate,
}: ReachPanelProps) {
  const valid = audienceValid(audience);
  const { data, error, pending, retry } = useAudienceEstimate(
    projectId,
    valid ? audienceInput(audience) : null
  );
  const onEstimateRef = useRef(onEstimate);
  useEffect(() => {
    onEstimateRef.current = onEstimate;
  });

  useEffect(() => {
    onEstimateRef.current?.(data);
  }, [data]);

  if (!valid)
    return (
      <Frame>
        <p className="text-[13px] text-muted-foreground">
          Pick a segment or add recipients to estimate reach.
        </p>
      </Frame>
    );

  if (error)
    return (
      <Frame>
        <div role="alert" className="flex flex-col gap-2 text-[13px]">
          <span className="text-destructive">
            {pushErrorMessage(error.code, error.message || "Estimate failed")}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-fit"
            onClick={retry}
          >
            Retry
          </Button>
        </div>
      </Frame>
    );

  // Pending or superseded: never show old numbers, and keep the loaded card's height.
  if (pending || !data)
    return (
      <Frame>
        <div
          role="status"
          aria-label="Calculating reach"
          className="flex min-h-[76px] flex-col gap-1"
        >
          <div className="flex h-8 items-center">
            <Skeleton className="h-7 w-28" />
          </div>
          <div className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-24" />
          </div>
          <div className="flex h-4 items-center">
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      </Frame>
    );

  // Very broad segments come back without a platform split (reachable: null).
  const unsplit = data.reachable === null;
  // Segments have no token data, so devices on non-push platforms only show up as this remainder.
  const nonPush =
    audience.type === "segment" && data.reachable != null && data.no_app != null
      ? data.devices - data.reachable - data.no_app - data.no_channel
      : 0;
  const lines = [
    data.no_channel > 0 && `${count(data.no_channel)} no push token`,
    data.not_found > 0 && `${count(data.not_found)} not found`,
    nonPush > 0 && `${count(nonPush)} on web or desktop — push isn't available`,
    unsplit &&
      "Couldn't split this audience by platform — some devices may not receive it.",
    ...PUSH_PLATFORMS.map(({ key, label }) => {
      const p = data.platforms?.[key];
      return (
        !unsplit &&
        p &&
        p.devices != null &&
        !p.configured &&
        p.devices > 0 &&
        `${count(p.devices)} ${label} ${devicesWord(p.devices)} won't receive it — push isn't set up`
      );
    }),
  ].filter((line): line is string => !!line);
  const split = PUSH_PLATFORMS.filter(({ key }) => {
    const p = data.platforms?.[key];
    return !unsplit && p?.configured && p.devices != null && p.devices > 0;
  });

  const splitTotal = split.reduce(
    (sum, { key }) => sum + (data.platforms?.[key]?.devices ?? 0),
    0
  );
  const share = (key: PushPlatform) =>
    splitTotal > 0
      ? Math.round(((data.platforms?.[key]?.devices ?? 0) / splitTotal) * 100)
      : 0;

  return (
    <Frame label="Estimated reach">
      <div className="flex min-h-[76px] flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">
              {count(reachCount(data))}
            </span>
            <span className="text-[13px] text-muted-foreground">
              {data.reachable == null
                ? devicesWord(reachCount(data))
                : `${devicesWord(data.reachable)} will receive it`}
            </span>
          </p>
          {data.persons != null && (
            <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <span className="font-medium tabular-nums text-foreground">
                {count(data.persons)}
              </span>
              people
              {data.incomplete && <IncompleteBadge />}
            </p>
          )}
        </div>
        {/* One platform would only repeat the hero number. */}
        {split.length > 1 && (
          <div
            role="group"
            aria-label="Reach by platform"
            className="flex flex-col gap-2"
          >
            <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-muted">
              {split.map(({ key }, i) => (
                <div
                  key={key}
                  className={cn(
                    "h-full",
                    i === 0 ? "bg-chart-users" : "bg-chart-users/35"
                  )}
                  style={{ width: `${share(key)}%` }}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
              {split.map(({ key, label }, i) => (
                <span key={key} className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-2 rounded-full",
                      i === 0 ? "bg-chart-users" : "bg-chart-users/35"
                    )}
                  />
                  <PlatformIcon platform={key} alt="" size={12} />
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium tabular-nums">
                    {count(data.platforms?.[key]?.devices)}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {share(key)}%
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
        {lines.length > 0 && (
          <ul className="flex flex-col gap-1 border-t border-sidebar-border pt-2.5 text-[13px] text-muted-foreground">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </Frame>
  );
}
