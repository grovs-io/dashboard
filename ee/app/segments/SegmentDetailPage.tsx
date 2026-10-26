"use client";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Tabs from "@radix-ui/react-tabs";
import { Archive, ArchiveRestore, Download, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ActionConfirm from "@/components/common/action-confirm";
import { ApiError } from "@/lib/ApiError";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import { segmentErrorMessage } from "@ee/lib/segments";
import type { SegmentCondition } from "@ee/types/segments";
import {
  useSegmentCountQuery,
  useSegmentQuery,
  useSegmentSizeHistoryQuery,
} from "@ee/hooks/queries/useSegmentsQueries";
import {
  useArchiveSegmentMutation,
  useRequestSegmentExportMutation,
  useRestoreSegmentMutation,
} from "@ee/hooks/mutations/useSegmentMutations";
import BreakdownPanel, {
  BreakdownDimensionPicker,
  defaultBreakdownDimension,
} from "@ee/components/segments/BreakdownPanel";
import DefinitionSummary from "@ee/components/segments/DefinitionSummary";
import ExportsPanel, {
  ExportButton,
} from "@ee/components/segments/ExportsPanel";
import IdentifierListPanel from "@ee/components/segments/IdentifierListPanel";
import ReachMetrics from "@ee/components/segments/ReachMetrics";
import SegmentDialog from "@ee/components/segments/SegmentDialog";
import SegmentMembers from "@ee/components/segments/SegmentMembers";
import {
  SegmentError,
  isClickhouseDown,
} from "@ee/components/segments/SegmentNotices";
import SizeHistoryChart from "@ee/components/segments/SizeHistoryChart";
import SegmentsShell, { type SegmentsContext } from "./SegmentsShell";

const tabClass =
  "-mb-px flex items-center gap-2 border-b-2 border-transparent px-0 pb-3 pt-1 text-sm whitespace-nowrap font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:border-primary data-[state=active]:text-primary";

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <span className="h-px flex-1 bg-sidebar-border" />
      </div>
      <span className="text-sm text-muted-foreground">{subtitle}</span>
    </div>
  );
}

function Panel({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[220px] flex-col rounded-md border border-sidebar-border bg-muted/50 p-4 dark:bg-card",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        {aside}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-busy="true"
      aria-label="Loading segment"
    >
      <div className="flex items-end justify-between gap-3 border-b border-sidebar-border pb-3">
        <div className="flex gap-6">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      <div className="flex flex-col gap-4 rounded-xl border border-sidebar-border bg-background p-4">
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              className="h-[86px] min-w-[150px] flex-1 rounded-[10px]"
            />
          ))}
        </div>
        <Skeleton className="h-[220px] w-full" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-40" />
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[220px] rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

function SegmentWorkspace({
  projectId,
  setTitle,
  segmentId,
}: SegmentsContext & { segmentId: string }) {
  const client = useQueryClient();
  const segment = useSegmentQuery(projectId, segmentId);
  const count = useSegmentCountQuery(
    projectId,
    segmentId,
    segment.isSuccess && !segment.data.archived
  );
  const history = useSegmentSizeHistoryQuery(projectId, segmentId);
  const archive = useArchiveSegmentMutation(projectId);
  const restore = useRestoreSegmentMutation(projectId);
  const requestExport = useRequestSegmentExportMutation(projectId);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [editing, setEditing] = useState<
    false | { addCondition?: SegmentCondition }
  >(false);
  const [dimension, setDimension] = useState(defaultBreakdownDimension);
  const name = segment.data?.name;
  useEffect(() => {
    if (name) setTitle(name);
  }, [name, setTitle]);

  if (segment.isPending) return <DetailSkeleton />;
  if (segment.isError) {
    if (segment.error instanceof ApiError && segment.error.status === 404)
      return (
        <p className="text-sm text-muted-foreground">Segment not found.</p>
      );
    return (
      <SegmentError
        error={segment.error}
        fallback="Could not load this segment."
        onRetry={() => void segment.refetch()}
      />
    );
  }
  const s = segment.data;
  const chDown = isClickhouseDown(count.error);
  const resultId = count.data?.result_id;
  const reload = () => {
    void client.invalidateQueries({
      queryKey: queryKeys.projects.segmentCount(projectId, segmentId),
    });
    void client.invalidateQueries({
      queryKey: queryKeys.projects.segmentMembersAll(projectId, segmentId),
    });
    void client.invalidateQueries({
      queryKey: queryKeys.projects.segmentBreakdownAll(projectId, segmentId),
    });
  };
  const fail = (e: unknown, fallback: string) =>
    showErrorNotification(
      e instanceof ApiError
        ? segmentErrorMessage(e.code, e.message || fallback)
        : fallback
    );
  const startExport = () =>
    requestExport.mutate(s.id, {
      onSuccess: () =>
        showSuccessNotification(
          "Export started. It will appear in the Exports panel on the Overview tab when the file is ready."
        ),
      onError: (e) => fail(e, "Could not start the export"),
    });

  return (
    <Tabs.Root defaultValue="overview" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-sidebar-border">
        <Tabs.List aria-label="Segment views" className="flex gap-4 sm:gap-6">
          <Tabs.Trigger value="overview" className={tabClass}>
            Overview
          </Tabs.Trigger>
          <Tabs.Trigger value="members" className={tabClass}>
            Members
          </Tabs.Trigger>
          <Tabs.Trigger value="identifiers" className={tabClass}>
            Identifier list
          </Tabs.Trigger>
        </Tabs.List>
        <div className="flex flex-wrap gap-2 pb-2">
          {s.archived ? (
            <Button
              variant="outline"
              onClick={() =>
                restore.mutate(s.id, {
                  onSuccess: () => showSuccessNotification("Segment restored"),
                  onError: (e) => fail(e, "Could not restore the segment"),
                })
              }
            >
              <ArchiveRestore className="size-4" /> Restore
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmArchive(true)}
              >
                <Archive className="size-4" /> Archive
              </Button>
              <Button
                variant="outline"
                disabled={requestExport.isPending}
                onClick={startExport}
              >
                <Download className="size-4" /> Export
              </Button>
              <Button variant="outline" onClick={() => setEditing({})}>
                <Pencil className="size-4" /> Edit
              </Button>
            </>
          )}
        </div>
      </div>
      {s.archived && (
        <p className="rounded-md border border-sidebar-border bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
          This segment is archived: it is no longer evaluated and does not
          appear in pickers.
        </p>
      )}
      {chDown && (
        <SegmentError
          error={count.error}
          fallback="Segments are unavailable right now."
          onRetry={() => void count.refetch()}
        />
      )}
      <Tabs.Content
        value="overview"
        className="flex flex-col gap-8 outline-none"
      >
        <div className="flex flex-col gap-4 rounded-xl border border-sidebar-border bg-background p-4">
          {s.archived ? (
            <p className="text-sm text-muted-foreground">
              Archived segments are not counted.
            </p>
          ) : chDown ? (
            <p className="text-sm text-muted-foreground">
              Exact counts need ClickHouse.
            </p>
          ) : (
            <ReachMetrics
              count={count.data}
              pending={count.isPending}
              error={count.error}
              onRetry={() => void count.refetch()}
              history={history.data}
              updatedAt={s.updated_at}
            />
          )}
          <SizeHistoryChart points={history.data} pending={history.isPending} />
        </div>
        <div className="flex flex-col gap-4">
          <SectionHeader
            title="Who is in it"
            subtitle="How the segment breaks down, what defines it, and your exports"
          />
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel
              title="Breakdown"
              aside={
                !chDown &&
                !s.archived && (
                  <BreakdownDimensionPicker
                    projectId={projectId}
                    value={dimension}
                    onChange={setDimension}
                  />
                )
              }
            >
              {s.archived ? (
                <p className="text-sm text-muted-foreground">
                  Archived segments are not evaluated.
                </p>
              ) : chDown ? (
                <p className="text-sm text-muted-foreground">
                  Breakdowns need ClickHouse.
                </p>
              ) : (
                <BreakdownPanel
                  projectId={projectId}
                  segmentId={segmentId}
                  resultId={resultId}
                  dimension={dimension}
                  onExpired={reload}
                  computing={count.isFetching}
                />
              )}
            </Panel>
            <Panel
              title="Definition"
              aside={
                !s.archived ? (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => setEditing({})}
                  >
                    Edit →
                  </Button>
                ) : undefined
              }
            >
              <DefinitionSummary definition={s.definition} />
            </Panel>
            <Panel
              title="Exports"
              aside={
                !s.archived ? (
                  <ExportButton
                    onClick={startExport}
                    busy={requestExport.isPending}
                  />
                ) : undefined
              }
            >
              <ExportsPanel
                projectId={projectId}
                segmentId={segmentId}
                definitionHash={s.definition_hash}
                onExport={s.archived ? undefined : startExport}
                exporting={requestExport.isPending}
              />
            </Panel>
          </div>
        </div>
      </Tabs.Content>
      <Tabs.Content value="members" className="outline-none">
        {s.archived ? (
          <p className="text-sm text-muted-foreground">
            Archived segments are not evaluated.
          </p>
        ) : chDown ? (
          <p className="text-sm text-muted-foreground">
            Members need ClickHouse.
          </p>
        ) : (
          <SegmentMembers
            projectId={projectId}
            segmentId={segmentId}
            resultId={resultId}
            onExpired={reload}
            computing={count.isFetching}
          />
        )}
      </Tabs.Content>
      <Tabs.Content value="identifiers" className="outline-none">
        <IdentifierListPanel
          projectId={projectId}
          segment={s}
          onEdit={
            s.archived
              ? undefined
              : () =>
                  setEditing({
                    addCondition: { type: "identifier", op: "in_list" },
                  })
          }
        />
      </Tabs.Content>
      <SegmentDialog
        open={editing !== false}
        onOpenChange={(open) => {
          if (!open) setEditing(false);
        }}
        projectId={projectId}
        segment={s}
        addCondition={editing === false ? undefined : editing.addCondition}
        onSaved={() => setEditing(false)}
      />
      <ActionConfirm
        open={confirmArchive}
        setOpen={setConfirmArchive}
        title="Archive this segment?"
        description="Archived segments stop being evaluated and disappear from pickers. You can restore it later."
        confirmText="Archive"
        onConfirm={async () => {
          try {
            await archive.mutateAsync(s.id);
            showSuccessNotification("Segment archived");
          } catch (e) {
            fail(e, "Could not archive the segment");
          }
        }}
      />
    </Tabs.Root>
  );
}

export default function SegmentDetailPage({
  segmentId,
}: {
  segmentId: string;
}) {
  return (
    <SegmentsShell title="Segment">
      {(ctx) => <SegmentWorkspace {...ctx} segmentId={segmentId} />}
    </SegmentsShell>
  );
}
