"use client";
import { useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import ActionConfirm from "@/components/common/action-confirm";
import AppHeader from "@/components/layout/app-header";
import SmartBannerDialog from "@/components/smart_banners/SmartBannerDialog";
import { SmartBannerSetupGate } from "@/components/smart_banners/SmartBannerSetup";
import SmartBannersEmptyState, {
  SmartBannersNoActiveState,
} from "@/components/smart_banners/SmartBannersEmptyState";
import SmartBannersSummary, {
  SmartBannersSummarySkeleton,
} from "@/components/smart_banners/SmartBannersSummary";
import SmartBannersTable, {
  PRIORITY_HINT,
  REORDER_LOCKED_HINT,
} from "@/components/smart_banners/SmartBannersTable";
import SmartBannersToolbar from "@/components/smart_banners/SmartBannersToolbar";
import { Button } from "@/components/ui/button";
import { useProjectSelection } from "@/context/useProjectSelection";
import {
  useDeleteSmartBannerMutation,
  useDuplicateSmartBannerMutation,
  useReorderSmartBannersMutation,
  useUpdateSmartBannerMutation,
} from "@/hooks/mutations/useSmartBannersMutations";
import {
  useSmartBannersQuery,
  useSmartBannersStatusQuery,
} from "@/hooks/queries/useSmartBannersQueries";
import { useUrlState } from "@/hooks/useUrlState";
import { getApiErrorInfo } from "@/lib/ApiError";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import { BANNER_PARAM, parseBannerParam } from "@/lib/smartBannerRoutes";
import {
  ACTION_STATUS,
  buildStatusFormData,
  filterBanners,
  isIntegrated,
  prioritised,
  type SmartBannerAction,
  type SmartBannerFilters,
} from "@/lib/smartBanners";
import type { SmartBanner } from "@/types";

const NO_FILTERS: SmartBannerFilters = { term: "", status: "", platform: "" };

function Workspace({
  projectId,
  domain,
}: {
  projectId: string;
  domain?: string;
}) {
  const query = useSmartBannersQuery(projectId);
  const update = useUpdateSmartBannerMutation(projectId);
  const remove = useDeleteSmartBannerMutation(projectId);
  const duplicate = useDuplicateSmartBannerMutation(projectId);
  const reorder = useReorderSmartBannersMutation(projectId);
  const [deleting, setDeleting] = useState<SmartBanner | null>(null);
  const [archiving, setArchiving] = useState<SmartBanner | null>(null);
  const [filters, setFilters] = useState(NO_FILTERS);
  // The open dialog lives in the URL, so /new and /[id] can redirect here.
  const [param, setParam] = useUrlState(BANNER_PARAM, "");
  const target = parseBannerParam(param);
  // Kept while the dialog animates out, so its title doesn't flip.
  const [shown, setShown] = useState(target);
  if (target !== null && target !== shown) setShown(target);
  const fail = (error: unknown) =>
    showErrorNotification(getApiErrorInfo(error).message);
  const banners = useMemo(() => query.data ?? [], [query.data]);
  const order = useMemo(() => prioritised(banners).map((b) => b.id), [banners]);
  const filtered =
    filters.term.trim() !== "" ||
    filters.status !== "" ||
    filters.platform !== "";
  const archivedView = filters.status === "archived";
  const rows = useMemo(
    () => filterBanners(banners, filters),
    [banners, filters]
  );

  const setStatus = (b: SmartBanner, action: SmartBannerAction) =>
    update.mutate(
      { id: b.id, fd: buildStatusFormData(ACTION_STATUS[action]!) },
      { onError: fail }
    );
  const onAction = (b: SmartBanner, action: SmartBannerAction) => {
    if (action === "delete") setDeleting(b);
    else if (action === "archive") setArchiving(b);
    else if (action === "duplicate")
      duplicate.mutate(b.id, {
        onSuccess: (copy) => {
          showSuccessNotification("Banner duplicated");
          setParam(String(copy.id));
        },
        onError: fail,
      });
    else if (ACTION_STATUS[action]) setStatus(b, action);
  };

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden px-6 md:gap-6 md:py-3">
      <div className="relative flex shrink-0 flex-wrap justify-between gap-2">
        <SmartBannersToolbar filters={filters} onChange={setFilters} />
        <div className="flex flex-wrap items-center justify-end gap-4">
          <Button
            size="sm"
            className="pl-3 pr-4"
            onClick={() => setParam("new")}
          >
            <Plus className="size-3.5" />
            New banner
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {query.isError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 text-sm"
          >
            <span className="text-destructive">
              Could not load smart banners.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              {query.isFetching ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Retry
            </Button>
          </div>
        ) : (
          <SmartBannersTable
            banners={rows}
            order={order}
            loading={query.isPending}
            reorderPending={reorder.isPending || query.isFetching}
            filtered={filtered}
            showPriority={!archivedView}
            onReorder={(ids) => reorder.mutate(ids, { onError: fail })}
            emptyState={
              banners.length === 0 ? (
                <SmartBannersEmptyState onCreate={() => setParam("new")} />
              ) : (
                <SmartBannersNoActiveState
                  onViewArchived={() =>
                    setFilters({ term: "", status: "archived", platform: "" })
                  }
                />
              )
            }
            actions={{ onOpen: (b) => setParam(String(b.id)), onAction }}
          />
        )}
        {(query.isPending || banners.length > 0) && (
          <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {order.length > 1 &&
                !archivedView &&
                `${filtered ? `${REORDER_LOCKED_HINT}.` : "Drag a row or use its menu to set priority."} ${PRIORITY_HINT}`}
            </p>
            {query.isPending ? (
              <SmartBannersSummarySkeleton />
            ) : (
              <SmartBannersSummary banners={rows} />
            )}
          </div>
        )}
      </div>
      <SmartBannerDialog
        open={target !== null}
        onOpenChange={(open) => !open && setParam("")}
        projectId={projectId}
        bannerId={shown === "new" || shown === null ? null : shown}
        domain={domain}
        actions={{ onOpen: () => {}, onAction }}
      />
      <ActionConfirm
        open={!!archiving}
        setOpen={(open) => !open && setArchiving(null)}
        title={`Archive ${archiving?.name ?? "this banner"}?`}
        description="It stops showing on your site and leaves the priority list. You can restore it from the Archived view."
        confirmText="Archive"
        pendingText="Archiving..."
        onConfirm={() => {
          if (archiving) setStatus(archiving, "archive");
          setArchiving(null);
        }}
      />
      <ActionConfirm
        open={!!deleting}
        setOpen={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "this banner"}?`}
        description="The banner stops showing on your site. Links it already handed out keep opening the app."
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
          } catch (error) {
            fail(error);
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}

export default function SmartBannersPage() {
  const { selectedProject } = useProjectSelection();
  const projectId = selectedProject?.id;
  const status = useSmartBannersStatusQuery(projectId);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <AppHeader titleOverride="Smart Banners" />
      {projectId && isIntegrated(status.data) ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          <Workspace
            key={projectId}
            projectId={projectId}
            domain={status.data!.domains[0]}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <SmartBannerSetupGate query={status} />
        </div>
      )}
    </div>
  );
}
