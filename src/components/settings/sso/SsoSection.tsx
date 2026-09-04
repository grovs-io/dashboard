"use client";

import { useState } from "react";
import {
  AlertTriangle,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import ActionConfirm from "@/components/common/action-confirm";
import CopyField from "./CopyField";
import SsoConnectionDialog from "./SsoConnectionDialog";
import SsoDomainsList from "./SsoDomainsList";
import ScimTokenDialog from "./ScimTokenDialog";
import AddDomainDialog from "./AddDomainDialog";
import RemoveDomainDialog from "./RemoveDomainDialog";
import { useSsoConnectionQuery } from "@/hooks/queries/useSsoQueries";
import {
  useUpsertSsoConnectionMutation,
  useDeleteSsoConnectionMutation,
  useVerifySsoDomainsMutation,
  useCreateScimTokenMutation,
  useDeleteScimTokenMutation,
} from "@/hooks/mutations/useSsoMutations";
import { getApiErrorInfo } from "@/lib/ApiError";
import { IS_SELF_HOSTED } from "@/lib/edition";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import type { SsoConnectionUpsertPayload } from "@/types";

export default function SsoSection({ instanceId }: { instanceId: string }) {
  const query = useSsoConnectionQuery(instanceId);
  const upsert = useUpsertSsoConnectionMutation(instanceId);
  const remove = useDeleteSsoConnectionMutation(instanceId);
  const verify = useVerifySsoDomainsMutation(instanceId);
  const createToken = useCreateScimTokenMutation(instanceId);
  const deleteToken = useDeleteScimTokenMutation(instanceId);

  const [editOpen, setEditOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [enforceConfirm, setEnforceConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [domainToRemove, setDomainToRemove] = useState<string | null>(null);

  const connection = query.data ?? null;

  const fail = (error: unknown, fallback: string) =>
    showErrorNotification(getApiErrorInfo(error, fallback).message);

  const handleSave = async (payload: SsoConnectionUpsertPayload) => {
    try {
      await upsert.mutateAsync(payload);
      showSuccessNotification("Single sign-on saved");
    } catch (error) {
      fail(error, "Could not save the connection");
      throw error;
    }
  };

  const handleEnforce = async (enforce: boolean) => {
    try {
      const response = await upsert.mutateAsync({ enforce });
      const revoked = response.data.sessions_revoked ?? 0;
      showSuccessNotification(
        enforce
          ? `Enforcement on. ${revoked} user${revoked === 1 ? "" : "s"} signed out.`
          : "Enforcement off"
      );
    } catch (error) {
      fail(error, "Could not change enforcement");
    }
  };

  const saveDomains = async (domains: string[], success: string) => {
    try {
      await upsert.mutateAsync({ domains });
      showSuccessNotification(success);
      return true;
    } catch (error) {
      fail(error, "Could not update the domains");
      return false;
    }
  };

  const handleAddDomains = async (domains: string[]) => {
    if (!connection) return;
    const ok = await saveDomains(
      [...connection.domains.map((d) => d.domain), ...domains],
      domains.length > 1 ? `${domains.length} domains added` : "Domain added"
    );
    if (!ok) throw new Error("domains not saved");
  };

  const handleRemoveDomain = async () => {
    if (!connection || !domainToRemove) return;
    await saveDomains(
      connection.domains
        .map((d) => d.domain)
        .filter((d) => d !== domainToRemove),
      "Domain removed"
    );
    setDomainToRemove(null);
  };

  const handleVerify = async () => {
    try {
      const response = await verify.mutateAsync();
      const pending =
        response.data.sso_connection?.domains.filter((d) => !d.verified_at)
          .length ?? 0;
      showSuccessNotification(
        pending === 0
          ? "All domains verified"
          : `${pending} domain${pending === 1 ? "" : "s"} still pending`
      );
    } catch (error) {
      fail(error, "Verification failed");
    }
  };

  const handleDelete = async () => {
    try {
      await remove.mutateAsync();
      showSuccessNotification("Single sign-on removed");
    } catch (error) {
      fail(error, "Could not remove the connection");
    }
  };

  const handleDisableScim = async () => {
    try {
      await deleteToken.mutateAsync();
      showSuccessNotification("SCIM disabled");
    } catch (error) {
      fail(error, "Could not disable SCIM");
    }
  };

  const active = connection?.active ?? false;
  const scim = connection?.scim;
  const scimState: "off" | "waiting" | "connected" = !scim?.token_set
    ? "off"
    : scim.last_used_at
      ? "connected"
      : "waiting";
  const scimOn = scimState === "connected";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-0.5 flex-1">
          <span className="text-sm font-semibold">Single sign-on</span>
          <span className="text-xs text-muted-foreground">
            Let your team sign in through your identity provider and provision
            accounts with SCIM.
          </span>
        </div>
        {connection ? (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        ) : (
          !query.isPending && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Set up
            </Button>
          )
        )}
      </div>

      {query.isPending && <Skeleton className="h-24 w-full rounded-md" />}

      {connection && (
        <div className="flex flex-col gap-8">
          <div
            className={cn(
              "rounded-xl border overflow-hidden divide-y divide-sidebar-border",
              active ? "border-valid-green/30" : "border-sidebar-border"
            )}
          >
            <StatusStrip
              active={active}
              icon={<ShieldCheck className="h-5 w-5" />}
              title={
                active
                  ? "Single sign-on is active"
                  : "Single sign-on is not active yet"
              }
              subtitle={
                active
                  ? connection.enforce
                    ? "Required for every verified domain."
                    : "Available to verified domains alongside passwords."
                  : "Verify at least one email domain to turn it on."
              }
              pill={active ? "Active" : "Inactive"}
              extra={
                connection.client_secret_expires_soon ? (
                  <Badge variant="destructive">Secret expires soon</Badge>
                ) : null
              }
            />

            <div className="px-5 py-4 grid gap-4 sm:grid-cols-2">
              <Field label="Identity provider" value={connection.issuer} />
              <Field label="Client ID" value={connection.client_id} />
              <div className="sm:col-span-2">
                <CopyField
                  id="sso-redirect-uri"
                  label="Redirect URI · add to the app registration's web redirect URIs"
                  value={connection.redirect_uri}
                />
              </div>
            </div>

            <div className="px-5 py-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5 flex-1">
                  <span className="text-sm font-medium">Email domains</span>
                  <span className="text-xs text-muted-foreground">
                    Only people with an address on a verified domain can sign in
                    through this connection.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!IS_SELF_HOSTED &&
                    connection.domains.some((d) => !d.verified_at) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleVerify}
                        disabled={verify.isPending}
                      >
                        Verify
                      </Button>
                    )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add domain
                  </Button>
                </div>
              </div>
              <SsoDomainsList
                domains={connection.domains}
                onRemove={(d) => setDomainToRemove(d)}
                disabled={upsert.isPending}
              />
            </div>

            <div className="px-5 py-4 flex items-center gap-4">
              <div className="flex flex-col gap-0.5 flex-1">
                <Label htmlFor="sso-enforce" className="text-sm font-medium">
                  Require single sign-on
                </Label>
                <span className="text-xs text-muted-foreground">
                  {active
                    ? "Passwords and social logins stop working for verified domains. Sign in through SSO yourself first."
                    : "Verify at least one domain first."}
                </span>
              </div>
              <Switch
                id="sso-enforce"
                checked={connection.enforce}
                disabled={!active || upsert.isPending}
                onCheckedChange={(next) =>
                  next ? setEnforceConfirm(true) : handleEnforce(false)
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">SCIM provisioning</span>
              <span className="text-xs text-muted-foreground">
                Let your identity provider create, update and deactivate
                accounts on this project.
              </span>
            </div>
            <div
              className={cn(
                "rounded-xl border overflow-hidden divide-y divide-sidebar-border",
                scimOn ? "border-valid-green/30" : "border-sidebar-border"
              )}
            >
              <StatusStrip
                active={scimOn}
                icon={<KeyRound className="h-5 w-5" />}
                title={
                  scimState === "connected"
                    ? "SCIM provisioning is connected"
                    : scimState === "waiting"
                      ? "Waiting for your identity provider"
                      : "SCIM provisioning is off"
                }
                subtitle={
                  scimState === "connected"
                    ? `Last contact ${formatRelative(scim?.last_used_at ?? null)}. Your identity provider creates, updates and deactivates accounts automatically.`
                    : scimState === "waiting"
                      ? "A token exists but nothing has called the API yet. Finish step 2 in your identity provider."
                      : "Your identity provider creates, updates and deactivates accounts on this project automatically."
                }
                pill={
                  scimState === "connected"
                    ? "Connected"
                    : scimState === "waiting"
                      ? "Waiting"
                      : "Off"
                }
              />
              <div className="px-5 py-4 flex flex-col divide-y divide-sidebar-border">
                <ScimStep
                  n={1}
                  title={
                    connection.scim.token_set
                      ? "Secret token is set"
                      : "Generate a secret token"
                  }
                  hint={
                    connection.scim.token_set
                      ? "Rotating stops the current token immediately."
                      : "Shown once. Paste it into your identity provider in step 2."
                  }
                  action={
                    <>
                      <Button
                        variant={
                          connection.scim.token_set ? "outline" : "default"
                        }
                        size="sm"
                        onClick={() => setTokenOpen(true)}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        {connection.scim.token_set
                          ? "Rotate token"
                          : "Generate token"}
                      </Button>
                      {scim?.enabled && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDisableScim}
                          disabled={deleteToken.isPending}
                        >
                          Disable
                        </Button>
                      )}
                    </>
                  }
                />
                <ScimStep
                  n={2}
                  title="Point your identity provider at this tenant URL"
                  hint="Entra ID: Enterprise application → Provisioning → Automatic → paste the URL and the token → Test connection → Save."
                >
                  <CopyField
                    id="sso-scim-url"
                    label="Tenant URL"
                    value={connection.scim.base_url}
                    className="w-full"
                  />
                </ScimStep>
                <ScimStep
                  n={3}
                  title="Assign users in your identity provider"
                  hint="Assigned users show up under Team Members. Unassigned users lose access and are signed out."
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-destructive">
                Danger zone
              </span>
              <span className="text-xs text-muted-foreground">
                Turning single sign-on off affects everyone on the verified
                domains.
              </span>
            </div>
            <div className="rounded-xl border border-destructive/20 overflow-hidden">
              <div className="px-5 py-5 flex items-center gap-4 bg-gradient-to-r from-destructive/5 to-destructive/[0.02]">
                <div className="flex items-center justify-center h-11 w-11 rounded-xl shrink-0 bg-destructive/10 ring-1 ring-destructive/15">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-sm font-semibold">
                    Remove single sign-on
                  </span>
                  <span className="text-xs text-muted-foreground leading-snug">
                    Deletes the connection and its domains. Accounts are kept
                    and fall back to passwords.
                    {connection.enforce ? " Turn enforcement off first." : ""}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive shrink-0"
                  onClick={() => setDeleteConfirm(true)}
                  disabled={connection.enforce}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SsoConnectionDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        connection={connection}
        onSave={handleSave}
      />
      <ScimTokenDialog
        open={tokenOpen}
        onOpenChange={setTokenOpen}
        rotating={connection?.scim.token_set ?? false}
        onCreate={async () => (await createToken.mutateAsync()).data.token}
      />
      <AddDomainDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        existing={connection?.domains.map((d) => d.domain) ?? []}
        onAdd={handleAddDomains}
      />
      <RemoveDomainDialog
        domain={domainToRemove}
        verified={
          connection?.domains.find((d) => d.domain === domainToRemove)
            ?.verified_at != null
        }
        onOpenChange={(open) => !open && setDomainToRemove(null)}
        onConfirm={handleRemoveDomain}
      />
      <ActionConfirm
        title="Require single sign-on for these domains?"
        description="Every user on a verified domain is signed out now and can only sign in through your identity provider. Make sure your own SSO login works first."
        confirmText="Require SSO"
        open={enforceConfirm}
        setOpen={setEnforceConfirm}
        onConfirm={() => handleEnforce(true)}
        showCloseButton={false}
      />
      <ActionConfirm
        title="Remove single sign-on?"
        description="The connection and its domains are deleted. Accounts are kept."
        confirmText="Remove"
        open={deleteConfirm}
        setOpen={setDeleteConfirm}
        onConfirm={handleDelete}
        showCloseButton={false}
      />
    </div>
  );
}

// Same shape as the Revenue Tracking card, so the two enterprise sections read as one family.
function StatusStrip({
  active,
  icon,
  title,
  subtitle,
  pill,
  extra,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  pill: string;
  extra?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "px-5 py-4 flex items-center gap-4",
        active
          ? "bg-gradient-to-r from-valid-green/8 to-valid-green/3"
          : "bg-muted/50"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center h-11 w-11 rounded-xl shrink-0",
          active
            ? "bg-valid-green/15 ring-1 ring-valid-green/20 text-valid-green"
            : "bg-background border border-sidebar-border shadow-sm text-muted-foreground"
        )}
      >
        {icon}
      </div>
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-sm font-semibold">{title}</span>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium",
              active
                ? "bg-valid-green/10 text-valid-green"
                : "bg-muted text-muted-foreground"
            )}
          >
            <div
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                active ? "bg-valid-green" : "bg-muted-foreground/40"
              )}
            />
            {pill}
          </div>
          {extra}
        </div>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-mono truncate" title={value}>
        {value}
      </span>
    </div>
  );
}

function ScimStep({
  n,
  title,
  hint,
  action,
  children,
}: {
  n: number;
  title: string;
  hint: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-4 first:pt-0 last:pb-0 flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
        {n}
      </span>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <span className="text-sm font-medium leading-6">{title}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
        {children && (
          <div className="mt-2 flex flex-wrap items-center gap-2 [&>*]:max-w-full">
            {children}
          </div>
        )}
      </div>
      {action && (
        <div className="flex items-center gap-2 shrink-0 self-center">
          {action}
        </div>
      )}
    </div>
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  );
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}
