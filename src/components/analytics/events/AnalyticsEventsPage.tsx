"use client";

import AppHeader from "@/components/layout/app-header";
import EventsExplorer from "./EventsExplorer";

export default function AnalyticsEventsPage() {
  return (
    <main className="flex flex-col relative overflow-hidden h-dvh">
      <AppHeader titleOverride="Events" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="@container/main flex flex-1 flex-col overflow-hidden">
          <EventsExplorer />
        </div>
      </div>
    </main>
  );
}
