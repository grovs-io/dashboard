"use client";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

// Why a choice can't be changed here, and where it can; shown when a locked option is clicked.
export default function LockedNotice({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[13px] font-medium">
        <Lock className="size-3.5 text-muted-foreground" />
        {title}
      </p>
      <p className="text-xs leading-snug text-muted-foreground">{detail}</p>
      {action && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
