"use client";
import { useEffect, useMemo, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import DataTable from "@/components/common/DataTable";
import type { PushCampaign } from "@ee/types/push";
import PushEmptyState from "./PushEmptyState";
import {
  PushRowActionsProvider,
  type PushRowActions,
} from "@ee/context/usePushRowActionsContext";
import { getPushCampaignsTableColumns } from "./PushCampaignsTableColumns";

interface Props {
  campaigns: PushCampaign[];
  loading: boolean;
  hasFilters: boolean;
  truncated: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  segmentNames: Map<string, string>;
  actions: PushRowActions;
  onCreate?: () => void;
}

const PushCampaignsTable = ({
  campaigns,
  loading,
  hasFilters,
  truncated,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  segmentNames,
  actions,
  onCreate,
}: Props) => {
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !onLoadMore) return;
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
    () => getPushCampaignsTableColumns(segmentNames),
    [segmentNames]
  );
  return (
    <PushRowActionsProvider value={actions}>
      <DataTable
        columns={columns}
        data={campaigns}
        selectedColumns={columns.map((c) => c.accessorKey as string)}
        onRowClick={actions.onOpen}
        getRowId={(c) => c.id}
        getRowAriaLabel={(c) => `Open push campaign ${c.name}`}
        loading={loading}
        hasFilters={hasFilters}
        ariaLabel="Push campaigns"
        emptyState={<PushEmptyState onCreate={onCreate} />}
        footerContent={
          hasMore || loadingMore ? (
            <div ref={sentinel} className="py-2">
              <Skeleton className="mx-auto h-4 w-32" />
            </div>
          ) : truncated ? (
            <p className="text-xs text-muted-foreground">
              Showing the 200 most recently created push campaigns.
            </p>
          ) : undefined
        }
      />
    </PushRowActionsProvider>
  );
};

export default PushCampaignsTable;
