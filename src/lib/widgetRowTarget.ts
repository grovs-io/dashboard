import { parseISO } from "date-fns";
import { buildExplorerHref } from "@/lib/explorerLink";
import { filterFieldFor, OTHER_KEY } from "@/lib/metricQuery";
import type { AnalyticsDateRangeParams, StoredFilter } from "@/types";

const LINKED_ONLY_METRICS = new Set(["link_views", "link_driven_installs"]);

/** Where a clicked widget row leads. */
export type RowTarget =
  | { kind: "campaign"; id: string }
  | { kind: "link"; id: string }
  | { kind: "explorer"; href: string };

/** Whether rowTarget can return a target for this groupBy + metric. */
export function rowsClickable(opts: {
  groupBy: string;
  metric?: string;
}): boolean {
  if (opts.groupBy === "campaign_id" || opts.groupBy === "link_id") return true;
  return !(opts.metric && LINKED_ONLY_METRICS.has(opts.metric));
}

export function rowTarget(opts: {
  groupBy: string;
  key: string;
  label: string;
  metric?: string;
  base: AnalyticsDateRangeParams;
  filters: ReadonlyArray<StoredFilter>;
}): RowTarget | null {
  const { groupBy, key, label } = opts;
  if (!key || key === OTHER_KEY) return null;
  if (groupBy === "campaign_id") return { kind: "campaign", id: key };
  if (groupBy === "link_id") return { kind: "link", id: key };
  // Explorer filters can't express "link-attributed only".
  if (!rowsClickable({ groupBy, metric: opts.metric })) return null;
  const field = filterFieldFor(groupBy);
  const href = buildExplorerHref({
    from: opts.base.start_date ? parseISO(opts.base.start_date) : undefined,
    to: opts.base.end_date ? parseISO(opts.base.end_date) : undefined,
    metric: opts.metric,
    filters: [
      ...opts.filters
        .filter((f) => !(f.field === field && f.operator === "is"))
        .map((f, i) => ({ ...f, id: `w${i}` })),
      { id: "row", field, value: key, operator: "is", displayValue: label },
    ],
  });
  return { kind: "explorer", href };
}
