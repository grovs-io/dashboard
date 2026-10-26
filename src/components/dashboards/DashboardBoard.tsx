"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SectionLabel } from "@/components/common/SectionLabel";
import { DashboardEmptyState } from "./DashboardEmptyState";
import {
  showErrorNotification,
  showGenericError,
  showSuccessNotification,
} from "@/lib/Notifications";
import { getApiErrorMessage } from "@/lib/apiErrorHelpers";
import {
  useDeleteDashboardMutation,
  useDeleteWidgetMutation,
  useUpdateDashboardMutation,
} from "@/hooks/mutations/useDashboardsMutations";
import type { QueryFilter } from "@/components/analytics/events/types";
import type {
  AnalyticsDateRangeParams,
  AnalyticsGranularity,
  Dashboard,
  DashboardWidget,
  WidgetPayload,
} from "@/types";
import type { RowTarget } from "@/lib/widgetRowTarget";
import { WidgetCard } from "./WidgetCard";
import { NewBoardBanner } from "./NewBoardBanner";
import type { WidgetRangeLimits } from "./widgetLayout";

export const MAX_WIDGETS = 20;

export function DashboardBoard({
  dashboard,
  projectId,
  base,
  pageFilters,
  granularity,
  limits,
  revenueEnabled = false,
  onAddWidget,
  onCreateWidget,
  onEditWidget,
  onRename,
  onDeleted,
  onRowClick,
  actionsHost,
}: {
  dashboard: Dashboard;
  projectId: string | undefined;
  base: AnalyticsDateRangeParams;
  pageFilters: QueryFilter[];
  granularity: AnalyticsGranularity;
  limits: WidgetRangeLimits;
  /** The instance collects revenue; gates the Revenue panel. */
  revenueEnabled?: boolean;
  onAddWidget: () => void;
  onCreateWidget: (payload: WidgetPayload) => Promise<void>;
  onEditWidget: (widget: DashboardWidget) => void;
  onRename: () => void;
  onDeleted: () => void;
  onRowClick?: (target: RowTarget) => void;
  /** When set, the header actions portal here instead of the board's own header row. */
  actionsHost?: HTMLElement | null;
}) {
  const updateDashboard = useUpdateDashboardMutation(projectId);
  const deleteDashboard = useDeleteDashboardMutation(projectId);
  const deleteWidget = useDeleteWidgetMutation(projectId);

  // Local order makes a drag feel instant; the server order wins again after each refetch.
  const [order, setOrder] = useState<number[]>(() =>
    dashboard.widgets.map((w) => w.id)
  );
  useEffect(
    () => setOrder(dashboard.widgets.map((w) => w.id)),
    [dashboard.widgets]
  );
  const byId = useMemo(
    () => new Map(dashboard.widgets.map((w) => [w.id, w])),
    [dashboard.widgets]
  );
  const widgets = order
    .map((id) => byId.get(id))
    .filter((w): w is DashboardWidget => !!w);

  const [pendingDelete, setPendingDelete] = useState<
    { kind: "widget"; widget: DashboardWidget } | { kind: "dashboard" } | null
  >(null);
  const [creating, setCreating] = useState(false);

  async function handleUseTemplate(payload: WidgetPayload) {
    setCreating(true);
    try {
      await onCreateWidget(payload);
    } catch (err) {
      showErrorNotification(
        getApiErrorMessage(err, "Couldn't add the widget. Please try again.")
      );
    } finally {
      setCreating(false);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(Number(active.id));
    const newIndex = order.indexOf(Number(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    try {
      await updateDashboard.mutateAsync({
        dashboardId: dashboard.id,
        payload: { widget_order: next },
      });
    } catch {
      setOrder(dashboard.widgets.map((w) => w.id));
      showGenericError();
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.kind === "widget") {
        await deleteWidget.mutateAsync({
          dashboardId: dashboard.id,
          widgetId: pendingDelete.widget.id,
        });
        showSuccessNotification("Widget deleted");
      } else {
        await deleteDashboard.mutateAsync(dashboard.id);
        showSuccessNotification("Dashboard deleted");
        onDeleted();
      }
    } catch {
      showGenericError();
    } finally {
      setPendingDelete(null);
    }
  }

  const actions = (
    <>
      {widgets.length > 0 && widgets.length < MAX_WIDGETS && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1 text-xs"
          onClick={onAddWidget}
        >
          <Plus className="size-3.5" />
          Add widget
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Dashboard actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setPendingDelete({ kind: "dashboard" })}
            className="text-destructive"
          >
            Delete dashboard
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  return (
    <section className="flex flex-col gap-4">
      {actionsHost ? (
        createPortal(actions, actionsHost)
      ) : (
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>
            <span
              className="block max-w-[300px] truncate"
              title={dashboard.name}
            >
              {dashboard.name}
            </span>
          </SectionLabel>
          <div className="flex items-center gap-1">{actions}</div>
        </div>
      )}

      <NewBoardBanner dashboardId={dashboard.id} />

      {widgets.length === 0 ? (
        <DashboardEmptyState
          onAddWidget={onAddWidget}
          onUseTemplate={handleUseTemplate}
          pending={creating}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-4 @3xl/main:grid-cols-3">
              {widgets.map((w) => (
                <WidgetCard
                  key={w.id}
                  widget={w}
                  projectId={projectId}
                  base={base}
                  pageFilters={pageFilters}
                  granularity={granularity}
                  limits={limits}
                  revenueEnabled={revenueEnabled}
                  onEdit={onEditWidget}
                  onRowClick={onRowClick}
                  onDelete={(widget) =>
                    setPendingDelete({ kind: "widget", widget })
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.kind === "dashboard"
                ? `Delete "${dashboard.name}"?`
                : `Delete "${pendingDelete?.kind === "widget" ? pendingDelete.widget.title : ""}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === "dashboard"
                ? "All its widgets are removed. This cannot be undone."
                : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
