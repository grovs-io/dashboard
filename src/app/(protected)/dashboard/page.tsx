"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// The dashboard now renders the Analytics Overview (with the onboarding guide
// on top). The old dashboard widgets have been retired in favour of it.
const AnalyticsOverviewPage = dynamic(
  () => import("@/components/analytics/overview/AnalyticsOverviewPage"),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px] w-full rounded-lg" />
        <Skeleton className="h-[100px] w-full rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[300px] rounded-lg" />
          <Skeleton className="h-[300px] rounded-lg" />
        </div>
      </div>
    ),
  }
);

export default function DashboardPage() {
  return <AnalyticsOverviewPage />;
}
