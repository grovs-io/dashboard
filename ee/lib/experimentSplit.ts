import type { ExperimentGroupId } from "@ee/types/experiment";

export interface SplitShare {
  id: ExperimentGroupId;
  label: string;
  // Percent of the whole audience, unrounded.
  share: number;
}

const LABELS: Record<ExperimentGroupId, string> = {
  a: "A",
  b: "B",
  c: "C",
  control: "Control group",
  project_control: "Project control group",
};

// The server's rule: the project control group off the top, then the campaign's
// control group, then the rest split evenly between the variants.
export function splitShares({
  controlGroup,
  variants,
  projectControlGroup = 0,
}: {
  controlGroup: number | null;
  // Variants after A, so 0 to 2.
  variants: number;
  projectControlGroup?: number;
}): SplitShare[] {
  const out: SplitShare[] = [];
  const project = Math.min(Math.max(projectControlGroup, 0), 100);
  if (project > 0)
    out.push({
      id: "project_control",
      label: LABELS.project_control,
      share: project,
    });
  const remaining = 100 - project;
  const control = (remaining * (controlGroup ?? 0)) / 100;
  if (control > 0)
    out.push({ id: "control", label: LABELS.control, share: control });
  const ids: ExperimentGroupId[] = ["a", "b", "c"];
  const count = Math.min(variants + 1, ids.length);
  const each = (remaining - control) / count;
  for (const id of ids.slice(0, count))
    out.push({ id, label: LABELS[id], share: each });
  return out;
}

// "42.8%": one decimal, none when whole.
export const sharePercent = (share: number) => `${Number(share.toFixed(1))}%`;

// "Control group 10% · A 45% · B 45%", with counts when the audience is known.
export function splitLegend(
  shares: SplitShare[],
  audience?: number | null
): string {
  return shares
    .map((s) => {
      const count =
        audience != null && audience > 0
          ? ` (${Math.round((audience * s.share) / 100).toLocaleString()})`
          : "";
      return `${s.label} ${sharePercent(s.share)}${count}`;
    })
    .join(" · ");
}
