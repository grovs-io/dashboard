"use client";
import { useEffect, useMemo, useRef } from "react";
import { flexRender, type CellContext } from "@tanstack/react-table";
import { MessageSquareText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import DataTable from "@/components/common/DataTable";
import {
  InAppRowActionsProvider,
  type InAppRowActions,
} from "@ee/context/useInAppRowActionsContext";
import type { InAppCampaign } from "@ee/types/inApp";
import { getInAppCampaignsTableColumns } from "./InAppCampaignsTableColumns";

interface Props {
  campaigns: InAppCampaign[];
  loading: boolean;
  hasFilters: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  segmentNames: Map<string, string>;
  actions: InAppRowActions;
  onCreate: () => void;
}

// Rows that stand for campaigns on their way, with the shape of each cell.
const WAITING = "waiting-";
const waiting = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${WAITING}${i}`,
  })) as InAppCampaign[];
const isWaiting = (campaign: InAppCampaign) => campaign.id.startsWith(WAITING);
const SHAPES: Record<string, string> = {
  name: "h-4 w-36",
  status: "h-[22px] w-14 rounded-full",
  template: "h-4 w-24",
  triggers: "h-4 w-44",
  audience: "h-4 w-20",
  updated_at: "h-4 w-32",
  id: "size-9",
};

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full flex-col items-center justify-center bg-sidebar px-4 py-14"
    >
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-muted">
        <MessageSquareText className="size-5 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-center text-sm font-semibold">
        No in-app messages yet
      </h3>
      <p className="mb-6 max-w-md text-center text-xs leading-relaxed text-muted-foreground">
        An in-app message shows inside your app the moment something happens:
        the app opens, a screen is viewed, or an event you track.
      </p>
      <Button className="pl-3 pr-4" onClick={onCreate}>
        <Plus className="size-4" />
        New message
      </Button>
    </div>
  );
}

export default function InAppCampaignsTable({
  campaigns,
  loading,
  hasFilters,
  hasMore,
  loadingMore,
  onLoadMore,
  segmentNames,
  actions,
  onCreate,
}: Props) {
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) onLoadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  const columns = useMemo(
    () =>
      getInAppCampaignsTableColumns(segmentNames).map((column) => ({
        ...column,
        cell: (context: CellContext<InAppCampaign, unknown>) =>
          isWaiting(context.row.original) ? (
            <Skeleton className={SHAPES[column.accessorKey as string]} />
          ) : (
            flexRender(column.cell, context)
          ),
      })),
    [segmentNames]
  );
  const rows = useMemo(
    () =>
      loading
        ? waiting(5)
        : loadingMore
          ? [...campaigns, ...waiting(3)]
          : campaigns,
    [campaigns, loading, loadingMore]
  );
  return (
    <InAppRowActionsProvider value={actions}>
      <div aria-busy={loading || loadingMore}>
        <DataTable
          columns={columns}
          data={rows}
          isRowClickable={(c) => !isWaiting(c)}
          selectedColumns={columns.map((c) => c.accessorKey as string)}
          onRowClick={actions.onOpen}
          getRowId={(c) => c.id}
          getRowAriaLabel={(c) => `Open in-app message ${c.name}`}
          hasFilters={hasFilters}
          ariaLabel="In-app messages"
          emptyState={<EmptyState onCreate={onCreate} />}
          footerContent={
            hasMore || loadingMore ? (
              <div ref={sentinel} className="h-px" />
            ) : undefined
          }
        />
      </div>
    </InAppRowActionsProvider>
  );
}
