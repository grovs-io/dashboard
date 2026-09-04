"use client";

import { CheckCircle2, Clock, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CopyField from "./CopyField";
import { IS_SELF_HOSTED } from "@/lib/edition";
import type { SsoDomain } from "@/types";

export default function SsoDomainsList({
  domains,
  onRemove,
  disabled = false,
}: {
  domains: SsoDomain[];
  onRemove?: (domain: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {domains.map((d) => (
        <div
          key={d.domain}
          className="rounded-lg border border-sidebar-border px-4 py-3 flex flex-col gap-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium font-mono">{d.domain}</span>
            {d.verified_at ? (
              <Badge variant="secondary" className="gap-1 text-valid-green">
                <CheckCircle2 className="h-3 w-3" /> Verified
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" /> Pending
              </Badge>
            )}
            {onRemove && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-7 px-2 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${d.domain}`}
                disabled={disabled}
                onClick={() => onRemove(d.domain)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {!d.verified_at && !IS_SELF_HOSTED && (
            <div className="grid gap-2">
              <span className="text-xs text-muted-foreground">
                Add this TXT record at your DNS provider, then press Verify.
              </span>
              <CopyField
                id={`sso-rec-name-${d.domain}`}
                label="Record name"
                value={d.record_name}
              />
              <CopyField
                id={`sso-rec-value-${d.domain}`}
                label="Record value"
                value={d.record_value}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
