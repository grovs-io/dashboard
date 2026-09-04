"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Skeleton className="h-10 w-48" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-[250px]" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <div className="flex-1" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-36" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-[400px] w-full rounded-lg" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

import AnalyticsEventsPage from "@/components/analytics/events/AnalyticsEventsPage";

export default function AnalyticsEvents() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <AnalyticsEventsPage />
    </Suspense>
  );
}
