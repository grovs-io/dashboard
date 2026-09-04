"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SsoConnection, SsoConnectionUpsertPayload } from "@/types";

const parseDomains = (text: string): string[] =>
  Array.from(
    new Set(
      text
        .split(/[\s,]+/)
        .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
        .filter(Boolean)
    )
  );

export default function SsoConnectionDialog({
  open,
  onOpenChange,
  connection,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: SsoConnection | null;
  onSave: (payload: SsoConnectionUpsertPayload) => Promise<void>;
}) {
  const editing = connection !== null;
  const [issuer, setIssuer] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [replacingSecret, setReplacingSecret] = useState(false);
  const [adminClaimValue, setAdminClaimValue] = useState("");
  const [domainsText, setDomainsText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIssuer(connection?.issuer ?? "");
    setClientId(connection?.client_id ?? "");
    setClientSecret("");
    setReplacingSecret(!connection?.client_secret_set);
    setAdminClaimValue(connection?.admin_claim_value ?? "");
    setDomainsText("");
    setSubmitting(false);
  }, [open, connection]);

  const trimmed = {
    issuer: issuer.trim(),
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    adminClaimValue: adminClaimValue.trim(),
  };
  const domains = parseDomains(domainsText);

  const changes: SsoConnectionUpsertPayload = {};
  if (!editing || trimmed.issuer !== connection.issuer)
    changes.issuer = trimmed.issuer;
  if (!editing || trimmed.clientId !== connection.client_id)
    changes.client_id = trimmed.clientId;
  if (trimmed.clientSecret) changes.client_secret = trimmed.clientSecret;
  if (
    !editing ||
    trimmed.adminClaimValue !== (connection.admin_claim_value ?? "")
  )
    changes.admin_claim_value = trimmed.adminClaimValue || null;
  if (!editing) changes.domains = domains;

  const complete =
    /^https:\/\/\S+$/.test(trimmed.issuer) &&
    trimmed.clientId.length > 0 &&
    (connection?.client_secret_set || trimmed.clientSecret.length > 0) &&
    (editing || domains.length > 0);
  const canSave = complete && Object.keys(changes).length > 0;

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await onSave(changes);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !submitting && onOpenChange(next)}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit single sign-on" : "Set up single sign-on"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Change the app registration this connection uses. Email domains are managed from the list below."
              : "Values from your identity provider's app registration. Entra ID: use the v2.0 issuer for your tenant."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="sso-issuer">Issuer URL</Label>
            <Input
              id="sso-issuer"
              placeholder="https://login.microsoftonline.com/<tenant-id>/v2.0"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              autoFocus={!editing}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sso-client-id">Client ID</Label>
            <Input
              id="sso-client-id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sso-client-secret">Client secret</Label>
            {replacingSecret ? (
              <div className="flex items-center gap-2">
                <Input
                  id="sso-client-secret"
                  type="password"
                  autoComplete="off"
                  placeholder={editing ? "New client secret" : undefined}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  autoFocus={editing}
                />
                {editing && (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setClientSecret("");
                      setReplacingSecret(false);
                    }}
                  >
                    Keep current
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  id="sso-client-secret"
                  readOnly
                  value="••••••••••••••••"
                  className="font-mono tracking-wider text-muted-foreground"
                />
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setReplacingSecret(true)}
                >
                  Replace
                </Button>
              </div>
            )}
            {editing && (
              <span className="text-xs text-muted-foreground">
                {replacingSecret
                  ? "Paste the new secret value from your identity provider."
                  : "Stored securely. Replace it when you rotate the secret in your identity provider."}
              </span>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sso-admin-role">Admin role value (optional)</Label>
            <Input
              id="sso-admin-role"
              placeholder="grovs-admin"
              value={adminClaimValue}
              onChange={(e) => setAdminClaimValue(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              Users whose token carries this app role become admins on first
              sign-in.
            </span>
          </div>
          {!editing && (
            <div className="grid gap-1.5">
              <Label htmlFor="sso-domains">Email domains</Label>
              <Textarea
                id="sso-domains"
                placeholder={"example.com\nsub.example.com"}
                value={domainsText}
                onChange={(e) => setDomainsText(e.target.value)}
                rows={3}
              />
              <span className="text-xs text-muted-foreground">
                One per line. Each domain is verified separately before it can
                sign in.
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave || submitting}
            className="gap-1.5"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {editing ? "Save changes" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
