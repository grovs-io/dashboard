"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import AuditEventDetails from "@/components/settings/audit/AuditEventDetails";
import type { AuditEvent } from "@/types";

export default function AuditEventDetailSheet({
  event,
  onClose,
}: {
  event: AuditEvent | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!event} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {event && (
          <>
            <SheetHeader>
              <SheetTitle className="font-mono text-sm">
                {event.action}
              </SheetTitle>
              <SheetDescription>
                {new Date(event.occurred_at).toLocaleString()}
              </SheetDescription>
            </SheetHeader>
            <AuditEventDetails event={event} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
