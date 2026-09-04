"use client";

import { Layers } from "lucide-react";
import { PlatformIcon, fmtNumber as fmt } from "../shared";
import type { PlatformVersion } from "../types";
import {
  AnalyticsEmptyState,
  AnalyticsNoResults,
} from "../AnalyticsEmptyState";

type FlatEntry = { platform: string; version: string; users: number };

function getTopEntries(
  versions: Record<string, PlatformVersion[]>
): FlatEntry[] {
  const entries: FlatEntry[] = [];
  for (const [platform, vList] of Object.entries(versions)) {
    for (const v of vList) {
      entries.push({ platform, version: v.version, users: v.users });
    }
  }
  return entries.sort((a, b) => b.users - a.users).slice(0, 10);
}

interface TopVersionsProps {
  data?: Record<string, PlatformVersion[]>;
  hasFilters?: boolean;
}

export function TopVersions({ data, hasFilters = false }: TopVersionsProps) {
  const entries = data ? getTopEntries(data) : [];
  const maxUsers = entries[0]?.users ?? 1;

  return (
    <div className="rounded-xl border border-sidebar-border bg-background shadow-none overflow-hidden">
      <div className="px-5 py-3 bg-muted/40 border-b border-sidebar-border">
        <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Top Versions
        </h3>
      </div>
      <div className="px-4 py-2">
        {entries.length === 0 &&
          (hasFilters ? (
            <AnalyticsNoResults />
          ) : (
            <AnalyticsEmptyState
              icon={Layers}
              title="No version data yet"
              description="See which app versions your users are running. Integrate the Grovs SDK and version data will be reported automatically."
              sdkDescription="No version data recorded yet. Data will appear here as users interact with your app."
              linkHref="/developers"
              linkLabel="Set up the SDK"
            />
          ))}
        {entries.map((e) => {
          const pct = (e.users / maxUsers) * 100;
          return (
            <div
              key={`${e.platform}-${e.version}`}
              className="flex items-center gap-2.5 py-1.5"
            >
              <PlatformIcon platform={e.platform} />
              <span className="text-[11px] font-medium text-foreground w-12 shrink-0 tabular-nums">
                v{e.version}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${Math.max(pct, 6)}%`,
                    background:
                      "linear-gradient(90deg, var(--chart-users), color-mix(in srgb, var(--chart-users) 60%, transparent))",
                  }}
                />
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                {fmt(e.users)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
