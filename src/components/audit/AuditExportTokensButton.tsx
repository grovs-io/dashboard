"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuditExportTokensSheet from "./AuditExportTokensSheet";

export default function AuditExportTokensButton({
  instanceId,
}: {
  instanceId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="shrink-0 gap-1.5"
      >
        <KeyRound className="size-3.5" />
        Export tokens
      </Button>
      <AuditExportTokensSheet
        instanceId={instanceId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
