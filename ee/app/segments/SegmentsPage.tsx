"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ACTIVE, ARCHIVED } from "@/constants/OptionsConstants";
import ActionConfirm from "@/components/common/action-confirm";
import { useUrlState } from "@/hooks/useUrlState";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import { ApiError } from "@/lib/ApiError";
import { segmentErrorMessage } from "@ee/lib/segments";
import { useSegmentsQuery } from "@ee/hooks/queries/useSegmentsQueries";
import {
  useArchiveSegmentMutation,
  useRequestSegmentExportMutation,
  useRestoreSegmentMutation,
} from "@ee/hooks/mutations/useSegmentMutations";
import SegmentDialog from "@ee/components/segments/SegmentDialog";
import SegmentsTable from "@ee/components/segments/SegmentsTable";
import type { Segment } from "@ee/types/segments";
import SegmentsShell, { type SegmentsContext } from "./SegmentsShell";

function SegmentsWorkspace({ projectId }: SegmentsContext) {
  const router = useRouter();
  const [status, setStatus] = useUrlState("status", ACTIVE);
  const archived = status === ARCHIVED;
  const query = useSegmentsQuery(projectId, archived);
  const archive = useArchiveSegmentMutation(projectId);
  const restore = useRestoreSegmentMutation(projectId);
  const requestExport = useRequestSegmentExportMutation(projectId);
  const [toArchive, setToArchive] = useState<Segment | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; segment?: Segment }>({
    open: false,
  });

  const fail = (error: unknown, fallback: string) =>
    showErrorNotification(
      error instanceof ApiError
        ? segmentErrorMessage(error.code, error.message || fallback)
        : fallback
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="cursor-pointer whitespace-nowrap"
            >
              {archived ? "Archived" : "Active"}
              <ChevronDown className="ml-1 size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-2 space-y-2">
            <div>
              <label className="text-sm text-muted-foreground">Status</label>
            </div>
            {[
              { label: "Active", value: ACTIVE },
              { label: "Archived", value: ARCHIVED },
            ].map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={status === option.value}
                  onCheckedChange={() => setStatus(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </PopoverContent>
        </Popover>
        <Button className="pl-3 pr-4" onClick={() => setDialog({ open: true })}>
          <Plus className="h-4 w-4" />
          New segment
        </Button>
      </div>
      {query.isError && (
        <p role="alert" className="text-sm text-destructive">
          {query.error instanceof ApiError
            ? segmentErrorMessage(query.error.code, query.error.message)
            : "Could not load segments."}
        </p>
      )}
      <SegmentsTable
        segments={query.data?.segments ?? []}
        loading={query.isPending}
        archived={archived}
        truncated={query.data?.truncated ?? false}
        onOpen={(s) => router.push(`/segments/${s.id}`)}
        onCreate={() => setDialog({ open: true })}
        actions={{
          onEdit: (s) => setDialog({ open: true, segment: s }),
          onExport: (s) =>
            requestExport.mutate(s.id, {
              onSuccess: () =>
                showSuccessNotification(
                  `Export of "${s.name}" started. We'll email you when it's ready; download it from the segment's Exports panel.`
                ),
              onError: (e) => fail(e, "Could not start the export"),
            }),
          onArchive: (s) => setToArchive(s),
          onRestore: (s) =>
            restore.mutate(s.id, {
              onSuccess: () => showSuccessNotification("Segment restored"),
              onError: (e) => fail(e, "Could not restore the segment"),
            }),
        }}
      />
      <SegmentDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        projectId={projectId}
        segment={dialog.segment}
        onSaved={(saved) => {
          setDialog({ open: false });
          if (!dialog.segment) router.push(`/segments/${saved.id}`);
        }}
      />
      <ActionConfirm
        open={toArchive !== null}
        setOpen={(open) => !open && setToArchive(null)}
        title="Archive this segment?"
        description="Archived segments stop being evaluated and disappear from pickers. You can restore it later."
        confirmText="Archive"
        onConfirm={async () => {
          if (!toArchive) return;
          try {
            await archive.mutateAsync(toArchive.id);
            showSuccessNotification("Segment archived");
          } catch (e) {
            fail(e, "Could not archive the segment");
          }
        }}
      />
    </div>
  );
}

export default function SegmentsPage() {
  return (
    <SegmentsShell title="Segments">
      {(ctx) => <SegmentsWorkspace {...ctx} />}
    </SegmentsShell>
  );
}
