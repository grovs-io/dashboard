"use client";
import { Button } from "@/components/ui/button";
import { BellRing, Plus } from "lucide-react";

export default function PushEmptyState({
  onCreate,
}: {
  onCreate?: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-14 px-4 w-full bg-sidebar"
    >
      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted mb-4">
        <BellRing className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground text-center mb-2">
        No push campaigns yet
      </h3>
      <p className="text-xs text-muted-foreground text-center leading-relaxed max-w-md mb-6">
        Push campaigns send a notification to a segment, a list of your user
        ids, or specific devices, and report delivery per device.
      </p>
      {onCreate && (
        <Button className="pl-3 pr-4" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          New campaign
        </Button>
      )}
    </div>
  );
}
