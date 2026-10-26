"use client";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  STEP_LABELS,
  pointers,
  stepOrder,
  stepSummary,
} from "@ee/lib/journeys";
import type { JourneyInput, JourneyReport } from "@ee/types/journey";

const num = "px-3 py-2 text-right align-top tabular-nums";

// The map's counts as rows, easier to scan than the map for a long journey.
export default function JourneyStepsTable({
  journey,
  report,
  segmentName,
}: {
  journey: JourneyInput;
  report: JourneyReport;
  segmentName: (id: string) => string | null;
}) {
  const order = stepOrder(journey);
  return (
    <div className="-mx-1 overflow-x-auto">
      <table aria-label="Steps" className="w-full min-w-[640px] text-[13px]">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="w-8 px-3 pb-2 font-medium">#</th>
            <th className="px-3 pb-2 font-medium">Step</th>
            <th className="px-3 pb-2 text-right font-medium">Reached</th>
            <th className="px-3 pb-2 text-right font-medium">Now</th>
            <th className="px-3 pb-2 font-medium">Paths</th>
            <th className="px-3 pb-2" />
          </tr>
        </thead>
        <tbody>
          {order.map((id, i) => {
            const step = journey.steps[id]!;
            const counts = report.steps[id];
            const paths = pointers(step).filter((p) => p.label);
            const channel =
              step.type === "push" || step.type === "in_app"
                ? step.campaign_id
                : null;
            return (
              <tr key={id} className="border-t border-sidebar-border">
                <td className="px-3 py-2 align-top tabular-nums text-muted-foreground">
                  {i + 1}
                </td>
                <td className="px-3 py-2 align-top">
                  <span className="font-medium">{STEP_LABELS[step.type]}</span>
                  <span className="block max-w-72 truncate text-xs text-muted-foreground">
                    {stepSummary(journey, step, segmentName)}
                  </span>
                </td>
                <td className={num}>
                  {(counts?.reached ?? 0).toLocaleString()}
                </td>
                <td className={num}>{(counts?.now ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                  {paths.length
                    ? paths.map((p) => (
                        <span
                          key={p.key}
                          className="mr-3 inline-block whitespace-nowrap"
                        >
                          {p.label}{" "}
                          <span className="font-medium tabular-nums text-foreground">
                            {(counts?.branches[p.key] ?? 0).toLocaleString()}
                          </span>
                        </span>
                      ))
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right align-top">
                  {channel && (
                    <Link
                      href={`/${step.type}/${channel}`}
                      className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-primary hover:underline"
                    >
                      {step.type === "push" ? "Push report" : "In-app report"}
                      <ExternalLink className="size-3" />
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
