"use client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, UserSearch } from "lucide-react";

const SegmentsEmptyState = ({
  onCreate,
  isArchived,
}: {
  onCreate?: () => void;
  isArchived?: boolean;
}) => (
  <div
    role="status"
    aria-live="polite"
    className="flex flex-col items-center justify-center py-14 px-4 w-full bg-sidebar"
  >
    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted mb-4">
      <UserSearch className="h-5 w-5 text-muted-foreground" />
    </div>
    <h3 className="text-sm font-semibold text-foreground text-center mb-2">
      {isArchived ? "No archived segments" : "No segments yet"}
    </h3>
    <p
      className={cn(
        "text-xs text-muted-foreground text-center leading-relaxed max-w-md",
        !isArchived && "mb-6"
      )}
    >
      {isArchived
        ? "Segments you archive will appear here. Restore one to use it again."
        : "Segments are reusable audiences: people matching conditions on their events, devices, profile, acquisition or purchases. Push campaigns and analytics filters pick from them."}
    </p>
    {!isArchived && onCreate && (
      <Button className="pl-3 pr-4" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        New segment
      </Button>
    )}
  </div>
);

export default SegmentsEmptyState;
