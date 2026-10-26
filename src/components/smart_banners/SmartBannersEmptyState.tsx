"use client";
import { PanelTop, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

// Same shape as the in-app and journeys empty tables.
export default function SmartBannersEmptyState({
  onCreate,
}: {
  onCreate: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full flex-col items-center justify-center bg-sidebar px-4 py-14"
    >
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-muted">
        <PanelTop className="size-5 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-center text-sm font-semibold">
        No smart banners yet
      </h3>
      <p className="mb-6 max-w-md text-center text-xs leading-relaxed text-muted-foreground">
        Your website is connected. A smart banner shows at the top or bottom of
        your mobile site and opens the app on the same page, or the store when
        it isn&apos;t installed.
      </p>
      <Button className="pl-3 pr-4" onClick={onCreate}>
        <Plus className="size-4" />
        Create your first banner
      </Button>
    </div>
  );
}

// Shown when every banner is archived, so the view isn't really empty.
export function SmartBannersNoActiveState({
  onViewArchived,
}: {
  onViewArchived: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full flex-col items-center justify-center bg-sidebar px-4 py-14"
    >
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-muted">
        <PanelTop className="size-5 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-center text-sm font-semibold">
        No active banners
      </h3>
      <p className="mb-6 max-w-md text-center text-xs leading-relaxed text-muted-foreground">
        Every banner is archived. Switch to the Archived view to restore one.
      </p>
      <Button variant="outline" onClick={onViewArchived}>
        View archived banners
      </Button>
    </div>
  );
}
