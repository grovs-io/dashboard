"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, KeyRound, Plus, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import DeleteConfirm from "@/components/common/delete-confirm";
import { useAuditExportTokensQuery } from "@/hooks/queries/useAuditQueries";
import {
  useCreateAuditExportTokenMutation,
  useRevokeAuditExportTokenMutation,
} from "@/hooks/mutations/useAuditMutations";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import { ApiError } from "@/lib/ApiError";
import { config } from "@/lib/config";
import CreateAuditExportTokenDialog from "@/components/settings/audit/CreateAuditExportTokenDialog";

export default function AuditExportTokensSheet({
  instanceId,
  open,
  onOpenChange,
}: {
  instanceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const tokensQuery = useAuditExportTokensQuery(instanceId, open);
  const createMutation = useCreateAuditExportTokenMutation(instanceId);
  const revokeMutation = useRevokeAuditExportTokenMutation(instanceId);
  const [createOpen, setCreateOpen] = useState(false);

  const forbidden =
    tokensQuery.error instanceof ApiError && tokensQuery.error.status === 403;
  const tokens = tokensQuery.data ?? [];

  const handleCreate = async (name: string) => {
    const res = await createMutation.mutateAsync({ name });
    return res.data.token;
  };

  const handleRevoke = async (tokenId: string) => {
    try {
      await revokeMutation.mutateAsync(tokenId);
      showSuccessNotification("Token revoked");
    } catch {
      showErrorNotification("Failed to revoke token");
    }
  };

  const createButton = (
    <Button
      variant="outline"
      size="sm"
      className="w-full border-dashed"
      onClick={() => setCreateOpen(true)}
    >
      <Plus className="h-3.5 w-3.5" />
      Create token
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Export tokens</SheetTitle>
          <SheetDescription>
            Give your SIEM read-only access to this audit log. Each token is
            shown once and can be revoked at any time.
          </SheetDescription>
        </SheetHeader>

        <CreateAuditExportTokenDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreate={handleCreate}
        />

        <div className="flex flex-col gap-4 px-4 pb-6">
          {forbidden ? (
            <p className="text-sm text-muted-foreground">
              You don&apos;t have access to export tokens for this project.
            </p>
          ) : tokensQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-lg border border-sidebar-border px-4 py-3 flex flex-col gap-2"
                >
                  <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-44 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : tokens.length === 0 ? (
            <div className="rounded-lg border border-sidebar-border px-5 py-8 flex flex-col items-center gap-3 text-center">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-muted ring-1 ring-sidebar-border">
                <KeyRound className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">No export tokens</span>
                <span className="text-xs text-muted-foreground leading-relaxed">
                  Create a token to stream this audit log to your SIEM.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="rounded-lg border border-sidebar-border overflow-hidden"
                >
                  <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-sidebar-border bg-muted/30">
                    <KeyRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate flex-1 min-w-0">
                      {token.name}
                    </span>
                    <DeleteConfirm
                      onConfirm={() => handleRevoke(token.id)}
                      title="Revoke token?"
                      description="Any SIEM using this token will stop receiving events immediately."
                      confirmText="Revoke"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Revoke
                      </Button>
                    </DeleteConfirm>
                  </div>
                  <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 px-4 py-3 text-xs">
                    <dt className="text-muted-foreground">Created</dt>
                    <dd className="truncate">
                      {formatDistanceToNow(new Date(token.created_at), {
                        addSuffix: true,
                      })}
                    </dd>
                    <dt className="text-muted-foreground">Created by</dt>
                    <dd className="truncate">
                      {token.created_by_email ?? "—"}
                    </dd>
                    <dt className="text-muted-foreground">Last used</dt>
                    <dd className="truncate">
                      {token.last_used_at ? (
                        formatDistanceToNow(new Date(token.last_used_at), {
                          addSuffix: true,
                        })
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </dd>
                  </dl>
                </div>
              ))}
            </div>
          )}

          {!forbidden && !tokensQuery.isLoading && createButton}

          {!forbidden && (
            <a
              href={`${config.docsUrl}/docs/audit-log/siem-integration`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
              View integration guide
            </a>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
