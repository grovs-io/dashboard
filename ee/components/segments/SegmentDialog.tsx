"use client";
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { Loader2, UserSearch, X } from "lucide-react";
import ActionConfirm from "@/components/common/action-confirm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/ApiError";
import { showSuccessNotification } from "@/lib/Notifications";
import { cn } from "@/lib/utils";
import { segmentSchema } from "@/schemas/segment";
import {
  useCreateSegmentMutation,
  useUpdateSegmentMutation,
} from "@ee/hooks/mutations/useSegmentMutations";
import {
  useSegmentCatalogueQuery,
  useSegmentEstimate,
} from "@ee/hooks/queries/useSegmentsQueries";
import { createBuilderReducer } from "@ee/lib/segmentBuilderReducer";
import {
  apiIssuePath,
  backendMessage,
  describeCondition,
  emptyDefinition,
  segmentErrorMessage,
  validateDefinition,
  withCondition,
  type SegmentIssue,
} from "@ee/lib/segments";
import type {
  Segment,
  SegmentCatalogue,
  SegmentCondition,
  SegmentDefinition,
} from "@ee/types/segments";
import SegmentBuilder from "./builder/SegmentBuilder";
import { IncompleteBadge, SegmentError } from "./SegmentNotices";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  segment?: Segment;
  onSaved: (segment: Segment) => void;
  addCondition?: SegmentCondition;
}

function Reach({
  projectId,
  definition,
  valid,
  hint,
  segmentId,
}: {
  projectId: string;
  definition: SegmentDefinition;
  valid: boolean;
  hint?: string;
  segmentId?: string;
}) {
  const { data, error, pending, retry } = useSegmentEstimate(
    projectId,
    definition,
    valid,
    500,
    segmentId
  );
  let body: React.ReactNode;
  if (!valid)
    body = (
      <p className="text-[13px] text-muted-foreground">
        {hint ?? "Add at least one complete condition to see who matches."}
      </p>
    );
  else if (error)
    body = (
      <div className="space-y-2 text-[13px]">
        <p role="alert" className="text-destructive">
          {error instanceof ApiError && error.code === "segment_busy"
            ? "The project is busy computing other segments. Try again in a moment."
            : error instanceof ApiError
              ? segmentErrorMessage(
                  error.code,
                  backendMessage(error) || "Estimate failed"
                )
              : "Estimate failed"}
        </p>
        {error instanceof ApiError &&
          (error.code === "segment_busy" || error.status === 503) && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7"
              onClick={retry}
            >
              Retry
            </Button>
          )}
      </div>
    );
  else if (pending || !data)
    body = (
      <div className="space-y-1">
        {data ? (
          <p className="text-2xl font-semibold tabular-nums text-muted-foreground/60">
            {data.persons.toLocaleString()}
          </p>
        ) : (
          <Skeleton className="h-8 w-28" />
        )}
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Calculating reach…
        </p>
      </div>
    );
  else
    body = (
      <div className="space-y-1" aria-label="Estimated reach">
        <p className="text-2xl font-semibold tabular-nums">
          {data.persons.toLocaleString()}
        </p>
        <p className="text-[13px] text-muted-foreground">
          people ·{" "}
          <span className="tabular-nums text-foreground">
            {data.devices.toLocaleString()}
          </span>{" "}
          devices{data.approximate ? " (approximate)" : ""}
        </p>
        {data.incomplete && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IncompleteBadge /> some data is past retention
          </p>
        )}
      </div>
    );
  return (
    <section className="rounded-lg bg-background p-3 shadow-sm ring-1 ring-sidebar-border dark:bg-muted">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Estimated reach
      </p>
      {body}
    </section>
  );
}

function Overview({
  name,
  definition,
}: {
  name: string;
  definition: SegmentDefinition;
}) {
  const conditions = definition.groups.reduce(
    (n, g) => n + g.conditions.length,
    0
  );
  return (
    <section className="space-y-3 px-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Overview
      </p>
      <p
        className={cn(
          "truncate text-sm font-medium",
          !name && "text-muted-foreground"
        )}
      >
        {name || "Untitled segment"}
      </p>
      <p className="text-xs text-muted-foreground">
        {definition.groups.length} group
        {definition.groups.length === 1 ? "" : "s"} · {conditions} condition
        {conditions === 1 ? "" : "s"}
        {definition.groups.length > 1 &&
          ` · match ${definition.operator === "or" ? "any" : "all"} group`}
      </p>
      <ol className="space-y-2">
        {definition.groups.map((group, g) => (
          <li
            key={g}
            className="rounded-md border border-sidebar-border/70 bg-background/60 p-2 text-xs"
          >
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Group {g + 1} · {group.operator === "and" ? "all" : "any"}
            </p>
            {group.conditions.length === 0 ? (
              <p className="text-muted-foreground">No conditions yet</p>
            ) : (
              <ul className="space-y-1">
                {group.conditions.map((c, i) => (
                  <li key={i} className="leading-snug">
                    {describeCondition(c)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

type CloseRef = MutableRefObject<(() => void) | null>;

function Form({
  projectId,
  catalogue,
  segment,
  addCondition,
  closeRef,
  onClose,
  onSaved,
}: {
  projectId: string;
  catalogue: SegmentCatalogue;
  segment?: Segment;
  addCondition?: SegmentCondition;
  closeRef: CloseRef;
  onClose: () => void;
  onSaved: (s: Segment) => void;
}) {
  const reducer = useMemo(() => createBuilderReducer(catalogue), [catalogue]);
  const [definition, dispatch] = useReducer(
    reducer,
    withCondition(segment?.definition ?? emptyDefinition(), addCondition)
  );
  const [name, setName] = useState(segment?.name ?? "");
  const [apiIssues, setApiIssues] = useState<SegmentIssue[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const create = useCreateSegmentMutation(projectId);
  const update = useUpdateSegmentMutation(projectId);
  const saving = create.isPending || update.isPending;
  const initial = useMemo(
    () =>
      JSON.stringify({
        name: segment?.name ?? "",
        definition: segment?.definition ?? emptyDefinition(),
      }),
    [segment]
  );
  const dirty = JSON.stringify({ name, definition }) !== initial;

  // The shell's X, overlay and Escape all go through this so unsaved edits get a confirmation first.
  useEffect(() => {
    closeRef.current = () => (dirty ? setConfirmDiscard(true) : onClose());
    return () => {
      closeRef.current = null;
    };
  }, [closeRef, dirty, onClose]);

  const localIssues = useMemo(
    () =>
      validateDefinition(definition, catalogue, {
        hasIdentifierList: segment?.has_identifier_list ?? false,
      }),
    [definition, catalogue, segment?.has_identifier_list]
  );
  const valid = localIssues.length === 0;
  const nameCheck = segmentSchema.safeParse({ name, description: "" });

  const act = (action: Parameters<typeof dispatch>[0]) => {
    setApiIssues([]);
    dispatch(action);
  };

  const save = async () => {
    setShowErrors(true);
    setFormError(null);
    setApiIssues([]);
    if (!nameCheck.success || !valid) return;
    const input = {
      name: nameCheck.data.name,
      description: segment?.description ?? null,
      definition,
    };
    try {
      const result = segment
        ? await update.mutateAsync({ id: segment.id, input })
        : await create.mutateAsync(input);
      showSuccessNotification(segment ? "Segment saved" : "Segment created");
      onSaved(result);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const { path, message } = apiIssuePath(backendMessage(e));
        if (path) setApiIssues([{ path, message }]);
        else setFormError(message);
      } else if (e instanceof ApiError)
        setFormError(
          segmentErrorMessage(
            e.code,
            backendMessage(e) || "Could not save the segment"
          )
        );
      else setFormError("Could not save the segment");
    }
  };

  const nameError =
    showErrors && !nameCheck.success
      ? nameCheck.error.issues[0]?.message
      : undefined;
  const conditionCount = definition.groups.reduce(
    (n, g) => n + g.conditions.length,
    0
  );
  const missing = !nameCheck.success
    ? "Give the segment a name before creating it."
    : conditionCount === 0
      ? "Add at least one condition, so the segment knows who to include."
      : !valid
        ? "Some conditions are incomplete. Fix the ones marked in red."
        : null;

  return (
    <>
      <div className="flex h-full min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-[260px] shrink-0 flex-col gap-4 overflow-auto border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground">
          <Reach
            projectId={projectId}
            definition={definition}
            valid={valid}
            hint={conditionCount === 0 ? undefined : localIssues[0]?.message}
            segmentId={segment?.id}
          />
          <Overview name={name} definition={definition} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col overflow-auto">
          <div className="flex flex-col gap-6 px-6 py-6">
            <div className="flex max-w-[560px] flex-col gap-2">
              <label htmlFor="segment-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="segment-name"
                autoFocus={!segment}
                maxLength={255}
                placeholder="e.g. Active iOS buyers"
                aria-invalid={!!nameError}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {nameError && (
                <p className="text-xs text-destructive">{nameError}</p>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-medium">Conditions</h3>
                <p className="text-[13px] text-muted-foreground">
                  Users match when they satisfy the groups below. The reach on
                  the left refreshes as you edit.
                </p>
              </div>
              <SegmentBuilder
                projectId={projectId}
                definition={definition}
                catalogue={catalogue}
                hasIdentifierList={segment?.has_identifier_list ?? false}
                issues={
                  showErrors || apiIssues.length > 0
                    ? [...localIssues, ...apiIssues]
                    : apiIssues
                }
                dispatch={act}
              />
              {segment && (
                <p className="text-xs text-muted-foreground">
                  Changing the conditions resets the size history.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      <Separator />
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 text-sm">
          {(formError || (showErrors && missing)) && (
            <p role="alert" className="text-destructive">
              {formError ?? missing}
            </p>
          )}
        </div>
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          aria-busy={saving}
        >
          {saving ? "Saving…" : segment ? "Save" : "Create"}
        </Button>
      </div>
      <ActionConfirm
        open={confirmDiscard}
        setOpen={setConfirmDiscard}
        onConfirm={onClose}
        title="Discard unsaved changes?"
        description="You have unsaved changes that will be lost if you close this dialog."
        confirmText="Discard"
        cancelText="Continue editing"
      />
    </>
  );
}

export default function SegmentDialog({
  open,
  onOpenChange,
  projectId,
  segment,
  onSaved,
  addCondition,
}: Props) {
  const catalogue = useSegmentCatalogueQuery(projectId);
  const closeRef = useRef<(() => void) | null>(null);
  const close = () => onOpenChange(false);
  const requestClose = () => (closeRef.current ?? close)();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
    >
      <DialogContent
        aria-describedby="segment-dialog-description"
        showCloseButton={false}
        className="flex h-[90vh] max-h-[860px] w-full flex-col gap-0 overflow-hidden border-sidebar-border p-0 sm:max-w-[90vw] xl:max-w-[1100px]"
      >
        <DialogDescription id="segment-dialog-description" className="sr-only">
          Create or edit a segment
        </DialogDescription>
        <DialogHeader>
          <div className="flex w-full items-center gap-3 px-5 py-3.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-primary">
              <UserSearch className="h-4 w-4" />
            </span>
            <DialogTitle className="text-[15px] font-semibold">
              {segment ? "Edit Segment" : "Create Segment"}
            </DialogTitle>
            <button
              type="button"
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={requestClose}
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>
        <Separator />
        {catalogue.isError ? (
          <div className="p-6">
            <SegmentError
              error={catalogue.error}
              fallback="Could not load the condition catalogue."
              onRetry={() => void catalogue.refetch()}
            />
          </div>
        ) : catalogue.isPending ? (
          <div className="p-6">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <Form
            key={segment?.id ?? "new"}
            projectId={projectId}
            catalogue={catalogue.data}
            segment={segment}
            addCondition={addCondition}
            closeRef={closeRef}
            onClose={close}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
