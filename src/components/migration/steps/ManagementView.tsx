"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SelectableConfirmTarget from "@/components/common/selectable-confirm-target";
import { cn } from "@/lib/utils";
import { migrationErrorToCopy } from "@/lib/migrationErrorToCopy";
import { getHealthLabel, type HealthTone } from "../getHealthLabel";
import { normalizeExtraHosts } from "../migrationPayload";
import ExtraHostsInput from "../ExtraHostsInput";
import type { CustomDomain, MigrationSource } from "@/types";

interface ManagementViewProps {
  source: MigrationSource;
  domain: CustomDomain | null;
  onRemoveAll: () => boolean | Promise<boolean>;
  onUpdateExtraHosts?: (hosts: string[]) => Promise<void>;
  lastVerifiedAt?: string;
}

const PROVIDER_NAME: Record<MigrationSource["provider"], string> = {
  branch: "Branch",
  appsflyer: "AppsFlyer",
};

const TONE_CLASSES: Record<HealthTone, string> = {
  green:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber:
    "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  grey: "border-border bg-muted text-muted-foreground",
};

const ManagementView = ({
  source,
  domain,
  onRemoveAll,
  onUpdateExtraHosts,
  lastVerifiedAt,
}: ManagementViewProps) => {
  const providerName = PROVIDER_NAME[source.provider];
  const displayHost = source.old_host || domain?.hostname || "";

  // Classic sources only reach this view when active; provider-hosted ones
  // reflect live health.
  const badge = source.provider_hosted
    ? getHealthLabel(source)
    : { tone: "green" as const, label: "Active" };

  const [editingHosts, setEditingHosts] = useState(false);
  const [draftHosts, setDraftHosts] = useState<string[]>(source.extra_hosts);
  const [hostsError, setHostsError] = useState<string | null>(null);
  const [savingHosts, setSavingHosts] = useState(false);

  const handleSaveHosts = async () => {
    if (!onUpdateExtraHosts) return;
    setSavingHosts(true);
    setHostsError(null);
    try {
      await onUpdateExtraHosts(
        normalizeExtraHosts(draftHosts, source.old_host)
      );
      setEditingHosts(false);
    } catch (err) {
      setHostsError(migrationErrorToCopy(err));
    } finally {
      setSavingHosts(false);
    }
  };

  const [removeOpen, setRemoveOpen] = useState(false);
  const [confirmHost, setConfirmHost] = useState("");
  const [isRemoving, setIsRemoving] = useState(false);

  const canConfirmRemove =
    confirmHost.trim() === source.old_host &&
    source.old_host.length > 0 &&
    !isRemoving;

  const handleRemoveConfirm = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!canConfirmRemove) return;
    setIsRemoving(true);
    let removed = false;
    try {
      removed = await onRemoveAll();
    } finally {
      setIsRemoving(false);
    }
    if (!removed) return;
    setRemoveOpen(false);
    setConfirmHost("");
  };

  const handleRemoveOpenChange = (open: boolean) => {
    if (isRemoving) return;
    setRemoveOpen(open);
    if (!open) setConfirmHost("");
  };

  const handleRemoveCancel = () => {
    if (isRemoving) return;
    setRemoveOpen(false);
    setConfirmHost("");
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-lg border border-sidebar-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Migrating from {providerName}
          </p>
          <p className="break-all font-mono text-sm font-medium leading-relaxed">
            {displayHost}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn("self-start sm:self-auto", TONE_CLASSES[badge.tone])}
          aria-label={`Migration status: ${badge.label}`}
        >
          {badge.label}
        </Badge>
      </div>

      {lastVerifiedAt !== undefined && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Last verified {lastVerifiedAt}
        </p>
      )}

      {source.provider_hosted && (
        <>
          <p className="text-xs leading-relaxed text-muted-foreground">
            SDK-only bridge — links opened in your app resolve through Grovs;
            web clicks keep going to {providerName}.
          </p>
          <div className="flex flex-col gap-2 rounded-lg border border-sidebar-border px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Extra hosts
              </p>
              {!editingHosts && onUpdateExtraHosts && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Edit extra hosts"
                  onClick={() => {
                    setDraftHosts(source.extra_hosts);
                    setHostsError(null);
                    setEditingHosts(true);
                  }}
                >
                  Edit
                </Button>
              )}
            </div>
            {editingHosts ? (
              <div className="flex flex-col gap-3">
                <ExtraHostsInput
                  value={draftHosts}
                  onChange={setDraftHosts}
                  mainHost={source.old_host}
                  error={hostsError}
                  disabled={savingHosts}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={savingHosts}
                    onClick={() => {
                      setEditingHosts(false);
                      setHostsError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    aria-label="Save extra hosts"
                    disabled={savingHosts}
                    onClick={handleSaveHosts}
                  >
                    {savingHosts && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            ) : source.extra_hosts.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {source.extra_hosts.map((host) => (
                  <span
                    key={host}
                    className="inline-flex items-center rounded-md border border-sidebar-border bg-secondary px-2 py-1 font-mono text-xs"
                  >
                    {host}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No extra hosts. Add sibling domains like xyz-alternate.app.link
                that serve the same links.
              </p>
            )}
          </div>
        </>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => setRemoveOpen(true)}
          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove migration
        </Button>
      </div>

      <AlertDialog open={removeOpen} onOpenChange={handleRemoveOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove migration?</AlertDialogTitle>
            <AlertDialogDescription>
              {source.provider_hosted
                ? `This removes the migration source. Old links will stop resolving inside your app; web clicks continue to go to ${providerName}. To confirm, type the hostname below.`
                : "This removes the migration source and the legacy hostname from Grovs. If DNS still points at Grovs after removal, old links will stop resolving. To confirm, type the hostname below."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="migration-remove-confirm">
              Type <SelectableConfirmTarget value={source.old_host} /> to
              confirm
            </Label>
            <Input
              id="migration-remove-confirm"
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={confirmHost}
              onChange={(event) => setConfirmHost(event.target.value)}
              placeholder={source.old_host}
              disabled={isRemoving}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleRemoveCancel}
              disabled={isRemoving}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleRemoveConfirm}
              disabled={!canConfirmRemove}
            >
              {isRemoving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isRemoving ? "Removing..." : "Remove migration"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ManagementView;
