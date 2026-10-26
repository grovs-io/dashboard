"use client";
import { BellOff } from "lucide-react";

export default function PushUnavailableNotice() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-14 px-4 w-full bg-sidebar"
    >
      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted mb-4">
        <BellOff className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground text-center mb-2">
        Push campaigns are not enabled
      </h3>
      <p className="text-xs text-muted-foreground text-center leading-relaxed max-w-md">
        Ask an instance admin to enable push campaigns for this project.
      </p>
    </div>
  );
}
