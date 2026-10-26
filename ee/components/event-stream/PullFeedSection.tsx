"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ExternalLink, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { ApiError } from "@/lib/ApiError";
import { config } from "@/lib/config";
import { eventStreamApi } from "@ee/api/event-stream/eventStreamService";
import { useFeedTokens } from "@ee/hooks/queries/useEventStreamQueries";
import type { StreamActions } from "@ee/hooks/mutations/useEventStreamActions";
import type { FeedToken } from "@ee/types/eventStream";
import { streamDate, streamError } from "@ee/lib/eventStream";
import SecretDialog from "./SecretDialog";
import {
  ConfirmAction,
  StreamError,
  StreamField,
  StreamToolbar,
} from "./StreamUi";

export default function PullFeedSection({
  toolbarTarget,
  projectId,
  admin,
  actions,
  onAccessError,
}: {
  toolbarTarget: HTMLElement | null;
  projectId: string;
  admin: boolean;
  actions: StreamActions;
  onAccessError: (status: number) => void;
}) {
  const tokens = useFeedTokens(projectId, admin);
  const [create, setCreate] = useState(false);
  const [revoke, setRevoke] = useState<FeedToken>();
  const revokeButton = useRef<HTMLButtonElement>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const [secret, setSecret] = useState<string>();
  useEffect(() => {
    if (
      tokens.error instanceof ApiError &&
      [402, 403].includes(tokens.error.status)
    )
      onAccessError(tokens.error.status);
  }, [tokens.error, onAccessError]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = String(
      new FormData(event.currentTarget).get("name") ?? ""
    ).trim();
    if (!name) return;
    const result = await actions.run(
      () => eventStreamApi.createToken(projectId, name),
      true
    );
    if (result) {
      setCreate(false);
      setSecret(result.token);
    }
  };
  return (
    <div className="space-y-5">
      <StreamToolbar target={toolbarTarget}>
        {admin && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Refresh tokens"
              title="Refresh tokens"
              onClick={() => {
                void tokens.refetch();
              }}
              disabled={tokens.isFetching}
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button
              ref={createButton}
              size="default"
              disabled={actions.pending || actions.reconciliationRequired}
              onClick={() => {
                actions.clearError();
                setCreate(true);
              }}
            >
              <Plus className="size-4" />
              Create feed token
            </Button>
          </div>
        )}
      </StreamToolbar>
      {admin ? (
        <section aria-label="Feed tokens" className="space-y-3">
          {tokens.error && (
            <StreamError
              message={`${tokens.data ? "Token list may be stale. " : ""}${streamError(tokens.error)}`}
            />
          )}
          {tokens.isPending ? (
            <p role="status" className="text-sm text-muted-foreground">
              Loading tokens…
            </p>
          ) : (
            tokens.data && (
              <div className="overflow-hidden rounded-lg border border-sidebar-border">
                <Table>
                  <TableHeader className="bg-table-header [&_th]:px-4">
                    <TableRow className="hover:bg-table-header">
                      <TableHead>Name</TableHead>
                      <TableHead>Created by</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last used</TableHead>
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tokens.data.map((token) => (
                      <TableRow
                        key={token.id}
                        className="bg-background [&_td]:px-4"
                      >
                        <TableCell className="font-medium">
                          {token.name}
                        </TableCell>
                        <TableCell>
                          {token.created_by_email ?? "Not available"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {streamDate(token.created_at)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {streamDate(token.last_used_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive focus-visible:text-destructive"
                            disabled={actions.pending}
                            aria-label={`Revoke ${token.name}`}
                            title={`Revoke ${token.name}`}
                            onClick={(event) => {
                              revokeButton.current = event.currentTarget;
                              actions.clearError();
                              setRevoke(token);
                            }}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!tokens.data.length && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="px-4 py-8 text-center whitespace-normal text-muted-foreground"
                        >
                          No active feed tokens. Create one for each polling
                          integration.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )
          )}
          <p className="text-xs text-muted-foreground">
            Token values are shown once when created. Store them securely.
          </p>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ask an instance admin to create or revoke feed tokens.
        </p>
      )}
      <a
        href={`${config.docsUrl}/docs/enterprise/event-stream`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-1 rounded-sm text-xs text-[var(--chart-users)] transition-colors hover:text-[var(--chart-users-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        How to read the feed
        <ExternalLink className="size-3" aria-hidden="true" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      {admin && create && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !actions.pending) setCreate(false);
          }}
        >
          <DialogContent showCloseButton={!actions.pending}>
            <DialogHeader>
              <DialogTitle>Create feed token</DialogTitle>
              <DialogDescription>
                A read-only credential for this project, shown once after
                creation.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={submit}>
              <StreamField
                label="Token name"
                name="name"
                required
                autoFocus
                disabled={actions.pending}
                placeholder="Warehouse ingestion"
              />
              <StreamError message={actions.error} />
              {actions.reconciliationRequired && (
                <p className="text-sm text-muted-foreground">
                  Close this form and use Refresh lists before creating another
                  token.
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={actions.pending}
                  onClick={() => setCreate(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={actions.pending || actions.reconciliationRequired}
                >
                  {actions.pending ? "Creating…" : "Create token"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
      {admin && secret && (
        <SecretDialog
          kind="token"
          value={secret}
          onClose={() => setSecret(undefined)}
        />
      )}
      {admin && revoke && (
        <ConfirmAction
          returnFocus={() =>
            revokeButton.current?.isConnected
              ? revokeButton.current
              : createButton.current
          }
          title={`Revoke ${revoke.name}?`}
          description="Integrations using this token will lose access immediately. Create a replacement first if they need to keep running. If this is the last token and there are no destinations, captured feed data is also removed; retained analytics history is unaffected."
          confirmLabel="Revoke token"
          destructive
          pending={actions.pending}
          error={actions.error}
          onClose={() => setRevoke(undefined)}
          onConfirm={async () => {
            const result = await actions.run(() =>
              eventStreamApi.revokeToken(projectId, revoke.id)
            );
            if (result) {
              revokeButton.current = null;
              setRevoke(undefined);
            }
          }}
        />
      )}
    </div>
  );
}
