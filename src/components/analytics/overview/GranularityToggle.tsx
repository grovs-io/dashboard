"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnalyticsGranularity } from "@/types";
import { GRANULARITIES } from "@/lib/analyticsGranularity";

const LABELS: Record<AnalyticsGranularity, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

export function GranularityToggle({
  value,
  onChange,
}: {
  value: AnalyticsGranularity;
  onChange: (g: AnalyticsGranularity) => void;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as AnalyticsGranularity)}
    >
      <TabsList aria-label="Chart granularity" className="h-8 w-full">
        {GRANULARITIES.map((g) => (
          <TabsTrigger key={g} value={g} className="px-3 text-xs">
            {LABELS[g]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
