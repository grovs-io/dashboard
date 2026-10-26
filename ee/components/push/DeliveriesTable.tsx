"use client";
import { useEffect, useRef, useState } from "react";
import type { AccessorKeyColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { OverviewPanelEmpty } from "@/components/analytics/overview/OverviewPanelEmpty";
import { Inbox, SearchX } from "lucide-react";
import { format, parseISO } from "date-fns";
import AudienceItemDetailsDialog from "@/components/audience/AudienceItemDetailsDialog";
import { PlatformIcon } from "@/components/analytics/shared";
import {
  DELIVERY_STATUSES,
  TONE_CLASSES,
  deliveryStatusLabel,
  deliveryStatusTone,
  errorCountLabel,
} from "@ee/lib/push";
import { usePushDeliveriesQuery } from "@ee/hooks/queries/usePushQueries";
import type { PushDelivery, PushDeliveryStatus } from "@ee/types/push";
import ReportCard from "./ReportCard";

const STATUS_OPTIONS: { label: string; value: PushDeliveryStatus | "all" }[] = [
  { label: "All", value: "all" },
  ...DELIVERY_STATUSES.map((value) => ({
    label: deliveryStatusLabel(value),
    value,
  })),
];

function DeliveryStatusPill({ status }: { status: PushDeliveryStatus }) {
  return (
    <Badge
      variant="outline"
      className={TONE_CLASSES[deliveryStatusTone(status)]}
    >
      {deliveryStatusLabel(status)}
    </Badge>
  );
}

const PLATFORM_LABELS: Record<string, string> = {
  ios: "iOS",
  android: "Android",
};

const header = (label: string) => (
  <span className="text-xs font-medium text-foreground">{label}</span>
);

const columns: AccessorKeyColumnDef<PushDelivery>[] = [
  {
    accessorKey: "platform",
    header: () => header("Device"),
    cell: ({ row }) =>
      row.original.platform ? (
        <span className="flex items-center gap-2 text-[13px]">
          <PlatformIcon platform={row.original.platform} alt="" size={12} />
          {PLATFORM_LABELS[row.original.platform] ?? row.original.platform}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "status",
    header: () => header("Status"),
    cell: ({ row }) => (
      <span className="flex flex-col items-start gap-1">
        <DeliveryStatusPill status={row.original.status} />
        {row.original.error && (
          <span className="text-[11.5px] text-muted-foreground">
            {errorCountLabel(row.original.error)}
          </span>
        )}
      </span>
    ),
  },
  {
    accessorKey: "opened_at",
    header: () => header("Opened"),
    cell: ({ row }) =>
      row.original.opened_at ? (
        <span className="text-xs tabular-nums">
          {format(parseISO(row.original.opened_at), "d MMM, HH:mm")}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "visitor",
    header: () => header("Visitor"),
    cell: ({ row }) => {
      const { visitor, recipient } = row.original;
      // Segment rows carry the literal "segment"; list rows keep the unmatched id.
      if (!visitor)
        return recipient && recipient !== "segment" ? (
          <span className="font-mono text-xs text-muted-foreground">
            {recipient}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      return (
        <span className="flex min-w-0 flex-col text-xs">
          <span className="truncate font-medium text-chart-users">
            {visitor.sdk_identifier ?? "Anonymous"}
          </span>
          <span className="truncate font-mono text-muted-foreground">
            {visitor.uuid}
          </span>
        </span>
      );
    },
  },
];

export default function DeliveriesTable({
  projectId,
  campaignId,
  className,
}: {
  projectId: string;
  campaignId: string;
  className?: string;
}) {
  const [status, setStatus] = useState<PushDeliveryStatus | "all">("all");
  const query = usePushDeliveriesQuery(
    projectId,
    campaignId,
    status === "all" ? undefined : status
  );
  const sentinel = useRef<HTMLDivElement | null>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage, isPlaceholderData } =
    query;
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // The previous filter's rows are a placeholder: paging them would restart the new first page.
        if (
          entries[0]?.isIntersecting &&
          hasNextPage &&
          !isFetchingNextPage &&
          !isPlaceholderData
        )
          void fetchNextPage();
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isPlaceholderData]);

  const deliveries = query.data?.pages.flatMap((p) => p.deliveries) ?? [];
  const [visitorId, setVisitorId] = useState<string | null>(null);

  return (
    <ReportCard
      title="Deliveries"
      className={className}
      aside={
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as PushDeliveryStatus | "all")}
        >
          <SelectTrigger
            size="sm"
            aria-label="Delivery status"
            className="w-[140px] bg-background"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <DataTable
        columns={columns}
        data={deliveries}
        selectedColumns={columns.map((c) => c.accessorKey as string)}
        getRowId={(d) => String(d.id)}
        onRowClick={(d) => d.visitor && setVisitorId(String(d.visitor.id))}
        isRowClickable={(d) => !!d.visitor}
        getRowAriaLabel={(d) =>
          `Open visitor ${d.visitor?.sdk_identifier ?? d.visitor?.uuid}`
        }
        loading={
          query.isPending || (query.isPlaceholderData && query.isFetching)
        }
        ariaLabel="Deliveries"
        stickyHeader
        containerClassName="relative max-h-[330px] overflow-y-auto overscroll-contain rounded-md border border-sidebar-border bg-background [&>[data-slot=table-container]]:overflow-visible"
        emptyState={
          <div className="bg-sidebar">
            <OverviewPanelEmpty
              icon={status === "all" ? Inbox : SearchX}
              title={
                status === "all"
                  ? "No deliveries yet"
                  : `No ${deliveryStatusLabel(status).toLowerCase()} deliveries`
              }
              description={
                status === "all"
                  ? "Devices appear here as the campaign is sent to them."
                  : "No device in this campaign has this status."
              }
            />
          </div>
        }
        footerContent={
          deliveries.length > 0 ? (
            <div
              ref={sentinel}
              className="py-2 text-center text-xs text-muted-foreground"
            >
              {hasNextPage || isFetchingNextPage ? (
                <Skeleton className="mx-auto h-4 w-32" />
              ) : (
                "End of results"
              )}
            </div>
          ) : undefined
        }
      />
      <p className="mt-2 text-[11.5px] text-muted-foreground">
        Rows are kept for 30 days. Select a row to open its visitor.
      </p>
      <AudienceItemDetailsDialog
        open={visitorId ? { id: visitorId } : null}
        onOpenChange={(next) => {
          if (!next) setVisitorId(null);
        }}
      />
    </ReportCard>
  );
}
