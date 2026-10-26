"use client";
import { useRef, useState } from "react";
import { Plus, RefreshCw, ChevronRight } from "lucide-react";
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
import { eventStreamApi } from "@ee/api/event-stream/eventStreamService";
import type {
  EventDestination,
  DestinationResponse,
} from "@ee/types/eventStream";
import type { StreamActions } from "@ee/hooks/mutations/useEventStreamActions";
import { streamDate, streamLag } from "@ee/lib/eventStream";
import DestinationStatus from "./DestinationStatus";
import DestinationDetails from "./DestinationDetails";
import DestinationForm from "./DestinationForm";
import SecretDialog from "./SecretDialog";
import ReplayDialog from "./ReplayDialog";
import { ConfirmAction, StreamError, StreamToolbar } from "./StreamUi";

export default function DestinationsSection({
  toolbarTarget,
  projectId,
  destinations,
  admin,
  actions,
  refreshing,
  onRefresh,
}: {
  toolbarTarget: HTMLElement | null;
  projectId: string;
  destinations: EventDestination[];
  admin: boolean;
  actions: StreamActions;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [form, setForm] = useState<"create" | EventDestination>();
  const [secret, setSecret] = useState<string>();
  const [dialog, setDialog] = useState<"delete" | "replay">();
  const listHeading = useRef<HTMLDivElement>(null);
  const selected = destinations.find((d) => d.id === selectedId);
  const returnToActions = () =>
    document.getElementById(`event-destination-actions-${selectedId}`);
  const closeUnavailable = () => {
    setSelectedId(undefined);
    setDialog(undefined);
    actions.clearError();
    requestAnimationFrame(() => listHeading.current?.focus());
  };
  const open = (kind: "delete" | "replay") => {
    actions.clearError();
    setDialog(kind);
  };
  const saved = (response: DestinationResponse) => {
    setForm(undefined);
    setSelectedId(response.event_destination.id);
    if (response.signing_secret) setSecret(response.signing_secret);
  };
  return (
    <div
      ref={listHeading}
      tabIndex={-1}
      aria-label="Destinations"
      className="space-y-5 outline-none"
    >
      <StreamToolbar target={toolbarTarget}>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Refresh"
            title="Refresh destinations"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "animate-spin" : ""} />
          </Button>
          {admin && (
            <Button
              size="default"
              onClick={() => {
                actions.clearError();
                setForm("create");
              }}
              disabled={actions.pending || actions.reconciliationRequired}
            >
              <Plus />
              Add destination
            </Button>
          )}
        </div>
      </StreamToolbar>
      <div>
        <div className="w-full overflow-hidden rounded-lg border border-sidebar-border bg-background">
          <Table>
            <TableHeader className="bg-table-header [&_th]:px-4">
              <TableRow className="hover:bg-table-header">
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead title="Age of the analytics bookmark">
                  Delivery lag
                </TableHead>
                <TableHead>Last delivery</TableHead>
                <TableHead className="sticky right-0 w-12 bg-table-header">
                  <span className="sr-only">View details</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {destinations.map((d) => (
                <TableRow
                  key={d.id}
                  className="cursor-pointer bg-background hover:bg-muted/30 [&_td]:px-4"
                  onClick={() => {
                    actions.clearError();
                    setSelectedId(d.id);
                  }}
                >
                  <TableCell className="py-4">
                    <button
                      className="text-left font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      id={`event-destination-${d.id}`}
                      aria-haspopup="dialog"
                    >
                      {d.name}
                    </button>
                    <p
                      className="mt-1 max-w-64 truncate text-xs text-muted-foreground"
                      title={
                        d.kind === "s3" ? d.settings.bucket : d.settings.url
                      }
                    >
                      {d.kind === "s3"
                        ? `s3://${d.settings.bucket}`
                        : d.settings.url}
                    </p>
                  </TableCell>
                  <TableCell>{d.kind === "s3" ? "S3" : "Webhook"}</TableCell>
                  <TableCell>
                    <DestinationStatus destination={d} />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {streamLag(d.lag_seconds)}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {streamDate(d.last_delivered_at)}
                  </TableCell>
                  <TableCell className="sticky right-0 bg-background text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`View ${d.name} details`}
                      aria-haspopup="dialog"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!destinations.length && (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center">
                    <p className="font-medium">No destinations yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {admin
                        ? "Add a webhook or S3 bucket to start delivering events."
                        : "An instance admin can add a destination for this project."}
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {selected && !form && !secret && !dialog && (
          <DestinationDetails
            key={selected.id}
            destination={selected}
            projectId={projectId}
            admin={admin}
            actions={actions}
            onEdit={() => {
              actions.clearError();
              setForm(selected);
            }}
            onReplay={() => open("replay")}
            onDelete={() => open("delete")}
            onClose={() => {
              setSelectedId(undefined);
              requestAnimationFrame(() => {
                (
                  document.getElementById(`event-destination-${selected.id}`) ??
                  listHeading.current
                )?.focus();
              });
            }}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Events are retained for 7 days. Delivery status refreshes automatically.
      </p>
      {selectedId && !selected && actions.error && !form && !secret && (
        <Dialog open onOpenChange={(open) => !open && closeUnavailable()}>
          <DialogContent onCloseAutoFocus={(event) => event.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Destination unavailable</DialogTitle>
              <DialogDescription>
                This destination is no longer in your project. The list has been
                refreshed. Choose another destination to continue.
              </DialogDescription>
            </DialogHeader>
            <StreamError message={actions.error} />
            <DialogFooter>
              <Button onClick={closeUnavailable}>Back to destinations</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {admin && form && (
        <DestinationForm
          projectId={projectId}
          destination={form === "create" ? undefined : form}
          actions={actions}
          onSaved={saved}
          onClose={() => setForm(undefined)}
        />
      )}
      {admin && secret && (
        <SecretDialog
          value={secret}
          kind="webhook"
          onClose={() => setSecret(undefined)}
        />
      )}
      {admin && selected && dialog === "replay" && (
        <ReplayDialog
          returnFocus={returnToActions}
          projectId={projectId}
          destination={selected}
          actions={actions}
          onClose={() => setDialog(undefined)}
        />
      )}
      {admin && selected && dialog === "delete" && (
        <ConfirmAction
          returnFocus={returnToActions}
          title={`Delete ${selected.name}?`}
          description="This stops delivery to this connection and removes its settings and bookmark. If this is the last destination and no active feed tokens remain, captured stream data is also purged. Retained analytics history is unaffected."
          confirmLabel="Delete destination"
          destructive
          pending={actions.pending}
          error={actions.error}
          onClose={() => setDialog(undefined)}
          onConfirm={async () => {
            const result = await actions.run(() =>
              eventStreamApi.removeDestination(projectId, selected.id)
            );
            if (result) {
              setDialog(undefined);
              setSelectedId(undefined);
              requestAnimationFrame(() => listHeading.current?.focus());
            }
          }}
        />
      )}
    </div>
  );
}
