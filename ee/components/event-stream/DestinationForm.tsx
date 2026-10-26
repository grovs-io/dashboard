"use client";
import { useState, type FormEvent } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import EventTypeSelect from "./EventTypeSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { IS_SELF_HOSTED } from "@/lib/edition";
import { cn } from "@/lib/utils";
import { eventStreamApi } from "@ee/api/event-stream/eventStreamService";
import { destinationInput, streamError } from "@ee/lib/eventStream";
import {
  DEFAULT_STREAM_TYPES,
  type EventDestination,
  type DestinationResponse,
  type DestinationKind,
} from "@ee/types/eventStream";
import type { StreamActions } from "@ee/hooks/mutations/useEventStreamActions";
import {
  StreamCheck,
  StreamError,
  StreamField,
  StreamSelect,
  StreamSwitch,
} from "./StreamUi";

function deliveryNumberError(value: string, maximum: number) {
  const number = Number(value);
  return value.trim() &&
    Number.isInteger(number) &&
    number >= 1 &&
    number <= maximum
    ? ""
    : `Enter a whole number between 1 and ${maximum}.`;
}

export default function DestinationForm({
  projectId,
  destination,
  actions,
  onSaved,
  onClose,
}: {
  projectId: string;
  destination?: EventDestination;
  actions: StreamActions;
  onSaved: (response: DestinationResponse) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<DestinationKind>(
    destination?.kind ?? "webhook"
  );
  const [credentialMode, setCredentialMode] = useState(
    destination ? "keep" : "replace"
  );
  const [headers, setHeaders] = useState<number[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    destination?.event_types ?? [...DEFAULT_STREAM_TYPES]
  );
  const [advanced, setAdvanced] = useState(false);
  const [batchSize, setBatchSize] = useState(
    String(destination?.batch_size ?? 100)
  );
  const [concurrency, setConcurrency] = useState(
    String(destination?.concurrency ?? 4)
  );
  const batchError = deliveryNumberError(batchSize, 500);
  const concurrencyError = deliveryNumberError(concurrency, 16);
  const invalidDelivery =
    kind === "webhook" && !!(batchError || concurrencyError);
  const [error, setError] = useState("");
  const settings = destination?.settings;
  const removedTypes = destination?.event_types.some(
    (type) => !selectedTypes.includes(type)
  );
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    actions.clearError();
    try {
      const input = destinationInput(
        new FormData(event.currentTarget),
        destination,
        IS_SELF_HOSTED
      );
      const response = await actions.run(() => {
        if (!destination)
          return eventStreamApi.createDestination(projectId, input);
        const { kind: _kind, ...update } = input;
        return eventStreamApi.updateDestination(
          projectId,
          destination.id,
          update
        );
      }, !destination);
      if (response) onSaved(response);
    } catch (cause) {
      setError(streamError(cause));
    }
  };
  const close = () => {
    actions.clearError();
    onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !actions.pending) close();
      }}
    >
      <DialogContent
        className="flex max-h-[90dvh] max-w-[calc(100vw_-_2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl ph-no-capture ph-mask"
        showCloseButton={!actions.pending}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-5 text-left">
          <DialogTitle>
            {destination ? "Edit destination" : "Add destination"}
          </DialogTitle>
          <DialogDescription>
            {destination
              ? "Update this connection independently of your other destinations."
              : "Send this project's events to a webhook or S3-compatible bucket."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5">
            <fieldset disabled={actions.pending} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <StreamField
                  name="name"
                  label="Name"
                  defaultValue={destination?.name}
                  maxLength={255}
                  required
                  autoFocus
                />
                <StreamSelect
                  name="kind"
                  label="Destination type"
                  value={kind}
                  disabled={!!destination || actions.pending}
                  onValueChange={(value) =>
                    setKind(value === "s3" ? "s3" : "webhook")
                  }
                  options={[
                    { value: "webhook", label: "Webhook" },
                    { value: "s3", label: "S3-compatible bucket" },
                  ]}
                />
              </div>
              {kind === "webhook" ? (
                <StreamField
                  name="url"
                  label="Webhook URL"
                  type="url"
                  placeholder="https://hooks.example.com/grovs"
                  defaultValue={settings?.url}
                  required
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <StreamField
                    name="bucket"
                    label="Bucket"
                    defaultValue={settings?.bucket}
                    required
                  />
                  <StreamField
                    name="region"
                    label="Region"
                    defaultValue={settings?.region}
                    placeholder="us-east-1"
                    required
                  />
                  <div className="space-y-2 sm:col-span-2">
                    <StreamField
                      label="S3 endpoint URL (optional for AWS)"
                      name="endpoint"
                      type="url"
                      placeholder="https://s3.example.com"
                      defaultValue={settings?.endpoint}
                      description="For other providers, enter the regional S3 API URL without the bucket name. Leave blank for AWS."
                    />
                    {!IS_SELF_HOSTED && (
                      <p className="text-xs text-muted-foreground">
                        Use any S3-compatible provider. On Grovs Cloud, the
                        endpoint must use HTTPS and resolve to a public address.
                      </p>
                    )}
                  </div>
                </div>
              )}
              <section className="space-y-3 border-t pt-5">
                <h3 className="text-sm font-semibold">Credentials</h3>
                {destination && (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {destination.has_credentials
                        ? "Credentials are stored. Their values cannot be retrieved."
                        : "No credentials are stored."}
                    </p>
                    <StreamSelect
                      name="credential_mode"
                      label="Stored credentials"
                      value={credentialMode}
                      onValueChange={setCredentialMode}
                      disabled={actions.pending}
                      options={[
                        { value: "keep", label: "Keep existing credentials" },
                        { value: "replace", label: "Replace all credentials" },
                        ...(kind === "webhook" || IS_SELF_HOSTED
                          ? [{ value: "clear", label: "Clear credentials" }]
                          : []),
                      ]}
                    />
                  </>
                )}
                {credentialMode === "clear" && (
                  <StreamCheck name="confirm_clear" required>
                    I understand this removes the stored credentials.
                  </StreamCheck>
                )}
                {credentialMode === "replace" && (
                  <>
                    {destination && (
                      <p className="text-xs text-muted-foreground">
                        Enter the complete replacement. Existing values will not
                        be merged.
                      </p>
                    )}
                    {kind === "webhook" ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Optional authentication headers. Values are stored
                          securely and never returned.
                        </p>
                        {headers.map((id, index) => (
                          <div key={id} className="flex items-end gap-2">
                            <div className="grid flex-1 gap-2 sm:grid-cols-2">
                              <StreamField
                                name="header_name"
                                label={`Header ${index + 1} name`}
                                placeholder="Authorization"
                                autoComplete="off"
                              />
                              <StreamField
                                name="header_value"
                                label={`Header ${index + 1} value`}
                                type="password"
                                autoComplete="new-password"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                              aria-label={`Remove header ${index + 1}`}
                              title={`Remove header ${index + 1}`}
                              onClick={() =>
                                setHeaders(
                                  headers.filter((item) => item !== id)
                                )
                              }
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-primary hover:text-primary"
                          onClick={() =>
                            setHeaders([
                              ...headers,
                              Math.max(-1, ...headers) + 1,
                            ])
                          }
                        >
                          <Plus className="size-4" />
                          Add header
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <StreamField
                            name="access_key_id"
                            label="Access key ID"
                            autoComplete="off"
                            required={!IS_SELF_HOSTED}
                          />
                          <StreamField
                            name="secret_access_key"
                            label="Secret access key"
                            type="password"
                            autoComplete="new-password"
                            required={!IS_SELF_HOSTED}
                          />
                        </div>
                        {IS_SELF_HOSTED && (
                          <p className="text-xs text-muted-foreground">
                            Leave both empty to use the deployment&apos;s
                            ambient credentials.
                          </p>
                        )}
                      </>
                    )}
                  </>
                )}
              </section>
              <div className="space-y-3 border-t pt-5">
                <EventTypeSelect
                  selected={selectedTypes}
                  onChange={setSelectedTypes}
                  disabled={actions.pending}
                />
                {removedTypes && (
                  <p role="note" className="rounded-md bg-muted p-3 text-sm">
                    Removing an event type gives up its backlog. Turning it back
                    on will not recover events from the excluded period; use an
                    export for that history.
                  </p>
                )}
                <div className="pt-3">
                  <StreamSwitch
                    name="include_ip"
                    label="Include IP address and city"
                    description="Add IP addresses and city-level location to delivered events."
                    defaultChecked={destination?.include_ip ?? false}
                    disabled={actions.pending}
                  />
                </div>
              </div>
              <Collapsible
                open={advanced}
                onOpenChange={setAdvanced}
                className="border-t pt-1"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 py-4 text-left"
                    disabled={actions.pending}
                  >
                    <span className="space-y-1">
                      <span className="block text-sm font-medium">
                        Advanced settings
                      </span>
                      <span
                        className={cn(
                          "block text-xs",
                          invalidDelivery
                            ? "text-destructive"
                            : "text-muted-foreground"
                        )}
                      >
                        {invalidDelivery
                          ? "Correct the delivery settings before saving."
                          : kind === "s3"
                            ? "Bucket options"
                            : "Batch size and concurrency"}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        advanced && "rotate-180"
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent
                  forceMount
                  onInvalidCapture={() => setAdvanced(true)}
                  className="space-y-4 pb-2 data-[state=closed]:hidden"
                >
                  {kind === "webhook" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <StreamField
                        label="Batch size"
                        name="batch_size"
                        type="number"
                        min={1}
                        max={500}
                        value={batchSize}
                        onChange={(event) => setBatchSize(event.target.value)}
                        step={1}
                        description="Events per request · 1–500"
                        error={batchError}
                        required
                      />
                      <StreamField
                        label="Concurrency"
                        name="concurrency"
                        type="number"
                        min={1}
                        max={16}
                        value={concurrency}
                        onChange={(event) => setConcurrency(event.target.value)}
                        step={1}
                        description="Parallel requests · 1–16"
                        error={concurrencyError}
                        required
                      />
                    </div>
                  )}

                  {kind === "s3" && (
                    <>
                      <StreamField
                        label="Object prefix (optional)"
                        name="prefix"
                        defaultValue={settings?.prefix}
                      />
                      <StreamSwitch
                        name="force_path_style"
                        label="Use path-style addressing"
                        description="Use the bucket name in the URL path for compatible storage providers."
                        defaultChecked={settings?.force_path_style}
                        disabled={actions.pending}
                      />
                    </>
                  )}
                </CollapsibleContent>
              </Collapsible>
              {!destination && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Delivery starts immediately.{" "}
                  {kind === "webhook"
                    ? "Next, save the signing secret and install it on your receiver, then send a test event."
                    : "After creation, send a test event to verify the bucket connection."}
                </p>
              )}
            </fieldset>
          </div>
          <div className="shrink-0 space-y-3 border-t bg-muted/30 px-6 py-4">
            <StreamError message={error || actions.error} />
            {actions.reconciliationRequired && !destination && (
              <p className="text-sm text-muted-foreground">
                Close this form and use Refresh lists before creating another
                destination.
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={actions.pending}
                onClick={close}
              >
                Cancel
              </Button>
              <Button
                disabled={
                  actions.pending ||
                  invalidDelivery ||
                  (!destination && actions.reconciliationRequired)
                }
                type="submit"
              >
                {actions.pending
                  ? "Saving…"
                  : destination
                    ? "Save changes"
                    : "Create and enable"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
