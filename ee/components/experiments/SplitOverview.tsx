"use client";
import { cn } from "@/lib/utils";
import {
  sharePercent,
  splitLegend,
  splitShares,
} from "@ee/lib/experimentSplit";
import type { ExperimentGroupId } from "@ee/types/experiment";

const TONES: Record<ExperimentGroupId, string> = {
  project_control: "bg-muted-foreground/25",
  control: "bg-muted-foreground/50",
  a: "bg-primary",
  b: "bg-primary/60",
  c: "bg-primary/35",
};

interface Props {
  controlGroup: number | null;
  // Variants after A, so 0 to 2.
  variants: number;
  projectControlGroup?: number;
  // Devices or people, when known: counts are added to the legend.
  audience?: number | null;
  className?: string;
  // Journeys name A "In the journey".
  labels?: Partial<Record<ExperimentGroupId, string>>;
}

// How people are split between the groups: a stacked bar and a legend line.
export default function SplitOverview({
  controlGroup,
  variants,
  projectControlGroup = 0,
  audience,
  className,
  labels,
}: Props) {
  const shares = splitShares({
    controlGroup,
    variants,
    projectControlGroup,
  }).map((s) => ({ ...s, label: labels?.[s.id] ?? s.label }));
  const legend = splitLegend(shares, audience);
  return (
    <div className={cn("space-y-1.5", className)} aria-label="Who gets what">
      <div
        role="img"
        aria-label={legend}
        className="flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-muted"
      >
        {shares.map((s) => (
          <span
            key={s.id}
            title={`${s.label} ${sharePercent(s.share)}`}
            className={cn("h-full", TONES[s.id])}
            style={{ width: `${s.share}%` }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{legend}</p>
    </div>
  );
}
