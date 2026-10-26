import { Skeleton } from "@/components/ui/skeleton";
import { dismissRate, formatCtr, sumStats } from "@/lib/smartBanners";
import type { SmartBanner } from "@/types";

export function SmartBannersSummarySkeleton() {
  return <Skeleton className="h-4 w-72" />;
}

// One quiet line of 30-day totals, in place of the Links page's pagination footer.
export default function SmartBannersSummary({
  banners,
}: {
  banners: SmartBanner[];
}) {
  const t = sumStats(banners);
  const rate = dismissRate(t.dismisses, t.views);
  const items = [
    ["Views", t.views.toLocaleString()],
    ["Clicks", t.clicks.toLocaleString()],
    ["CTR", formatCtr(t.ctr)],
    ["Dismisses", t.dismisses.toLocaleString()],
    ["Dismiss rate", rate === undefined ? "-" : formatCtr(rate)],
    ["Installs", t.installs.toLocaleString()],
  ];
  return (
    <section
      aria-label="Last 30 days"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
    >
      <span>Last 30 days</span>
      {items.map(([label, value]) => (
        <span key={label}>
          {label}{" "}
          <span className="font-medium tabular-nums text-foreground">
            {value}
          </span>
        </span>
      ))}
    </section>
  );
}
