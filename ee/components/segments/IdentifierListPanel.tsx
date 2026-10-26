"use client";
import { useRef, useState, type DragEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  FileSpreadsheet,
  ListChecks,
  Loader2,
  Pencil,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/ApiError";
import { showSuccessNotification } from "@/lib/Notifications";
import { cn } from "@/lib/utils";
import { useReplaceIdentifierListMutation } from "@ee/hooks/mutations/useSegmentMutations";
import { backendMessage, segmentErrorMessage } from "@ee/lib/segments";
import type { Segment } from "@ee/types/segments";
import IdentifierListPreview from "./IdentifierListPreview";

const usesList = (segment: Segment) =>
  segment.definition.groups.some((g) =>
    g.conditions.some(
      (c) =>
        c.type === "identifier" &&
        (c.op === "in_list" || c.op === "not_in_list")
    )
  );

export default function IdentifierListPanel({
  projectId,
  segment,
  onEdit,
}: {
  projectId: string;
  segment: Segment;
  onEdit?: () => void;
}) {
  const replace = useReplaceIdentifierListMutation(projectId);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [pasting, setPasting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const identifiers = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const staged = file ? 1 : identifiers.length;
  const inUse = usesList(segment);
  const list = segment.identifier_list;

  const reset = () => {
    setFile(null);
    setText("");
    setPasting(false);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const submit = async () => {
    setError(null);
    let payload: FormData | { identifiers: string[] };
    if (file) {
      payload = new FormData();
      payload.append("file", file);
    } else payload = { identifiers };
    try {
      const result = await replace.mutateAsync({ id: segment.id, payload });
      reset();
      showSuccessNotification(
        `Identifier list replaced with ${result.count.toLocaleString()} identifiers`
      );
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.status === 409
            ? "Another upload for this segment is still running. Try again in a minute."
            : segmentErrorMessage(e.code, backendMessage(e) || "Upload failed")
          : "Upload failed"
      );
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      setPasting(false);
    }
  };

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Your own user ids, as your app sets them on sign-in. Once uploaded, an
        Identifier condition can limit this segment to the people in the list,
        or leave them out.
      </p>

      <div
        className={cn(
          "flex flex-wrap items-center gap-4 rounded-md border px-4 py-3",
          list && inUse
            ? "border-valid-green/20 bg-valid-green-light/30 dark:bg-valid-green/5"
            : "border-sidebar-border bg-muted/50 dark:bg-card"
        )}
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md ring-1",
            list && inUse
              ? "bg-background text-valid-green ring-valid-green/20"
              : "bg-background text-muted-foreground ring-sidebar-border"
          )}
        >
          <ListChecks className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {list
              ? `${list.count != null ? list.count.toLocaleString() : "A list of"} identifier${list.count === 1 ? "" : "s"} uploaded${list.updated_at ? ` · ${formatDistanceToNow(new Date(list.updated_at), { addSuffix: true })}` : ""}`
              : "No list uploaded yet"}
          </p>
          <p className="text-sm text-muted-foreground">
            {!list
              ? "Members only change once a condition uses the list."
              : inUse
                ? "Members are limited to the people in this list."
                : "Not applied yet: members only change once a condition uses this list."}
          </p>
        </div>
        {list && inUse && (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-valid-green">
            <CheckCircle2 className="size-4" /> Applied
          </span>
        )}
        {list && !inUse && onEdit && (
          <Button type="button" size="sm" className="shrink-0" onClick={onEdit}>
            <Pencil className="size-3.5" /> Add the condition
          </Button>
        )}
      </div>

      {list && (
        <IdentifierListPreview
          projectId={projectId}
          segmentId={segment.id}
          total={list.count}
        />
      )}

      {!segment.archived ? (
        <div className="flex flex-col gap-3">
          {file ? (
            <div className="flex items-center gap-3 rounded-md border border-sidebar-border bg-background px-4 py-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <FileSpreadsheet className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(0)} KB · first column is the
                  identifier
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Remove file"
                onClick={reset}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : pasting ? (
            <Textarea
              id="identifier-text"
              aria-label="Paste identifiers, one per line"
              rows={8}
              autoFocus
              className="min-h-[180px] resize-y bg-background font-mono text-[13px]"
              value={text}
              placeholder={"one identifier per line\nuser_123\nuser_456"}
              onChange={(e) => setText(e.target.value)}
            />
          ) : (
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload a CSV"
              onClick={() => fileInput.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  fileInput.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex cursor-pointer items-center gap-4 rounded-md border border-dashed px-5 py-4 transition-colors",
                dragging
                  ? "border-primary bg-accent"
                  : "border-sidebar-border bg-muted/40 hover:bg-muted/70 dark:bg-card"
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-sidebar-border">
                <Upload className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {list
                    ? "Drop a CSV to replace the list, or browse"
                    : "Drop a CSV here, or browse"}
                </p>
                <p className="text-xs text-muted-foreground">
                  First column holds the identifier · header row optional · up
                  to 200,000 rows
                </p>
              </div>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto shrink-0 p-0 font-normal"
                onClick={(e) => {
                  e.stopPropagation();
                  setPasting(true);
                }}
              >
                Paste instead
              </Button>
            </div>
          )}
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="CSV file"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPasting(false);
            }}
          />

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          {(staged > 0 || pasting) && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={replace.isPending || staged === 0}
                onClick={() => void submit()}
              >
                {replace.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {replace.isPending
                  ? "Uploading…"
                  : list
                    ? "Replace current list"
                    : "Publish list"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={reset}
                disabled={replace.isPending}
              >
                Cancel
              </Button>
              <span className="text-xs text-muted-foreground">
                {replace.isPending
                  ? "Checking and publishing…"
                  : file
                    ? "Replaces the whole list"
                    : identifiers.length > 0
                      ? `${identifiers.length.toLocaleString()} identifiers · replaces the whole list`
                      : "One identifier per line"}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Restore the segment to upload a list.
        </p>
      )}
    </div>
  );
}
