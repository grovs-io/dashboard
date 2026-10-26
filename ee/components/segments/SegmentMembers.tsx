"use client";
import { useEffect, useRef, useState } from "react";
import { useRecoverExpiredResult } from "@ee/hooks/useRecoverExpiredResult";
import type { AccessorKeyColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Search } from "lucide-react";
import DataTable from "@/components/common/DataTable";
import AudienceItemDetailsDialog from "@/components/audience/AudienceItemDetailsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/ApiError";
import { useSegmentMembersQuery } from "@ee/hooks/queries/useSegmentsQueries";
import type { SegmentMember } from "@ee/types/segments";
import { SegmentError } from "./SegmentNotices";

function HeadCell({ label }: { label: string }) {
  return <Button variant="ghost">{label}</Button>;
}
const head = (label: string) => {
  const Head = () => <HeadCell label={label} />;
  Head.displayName = `Head(${label})`;
  return Head;
};

const columns: AccessorKeyColumnDef<SegmentMember>[] = [
  {
    accessorKey: "sdk_identifier",
    header: head("Identifier"),
    cell: ({ row }) => (
      <span className="pl-4">
        {row.original.sdk_identifier ?? (
          <span className="text-muted-foreground">anonymous</span>
        )}
      </span>
    ),
  },
  {
    accessorKey: "uuid",
    header: head("Device"),
    cell: ({ row }) => (
      <span className="pl-4 font-mono text-xs">{row.original.uuid}</span>
    ),
  },
  {
    accessorKey: "web_visitor",
    header: head("Kind"),
    cell: ({ row }) => (
      <span className="pl-4">{row.original.web_visitor ? "Web" : "App"}</span>
    ),
  },
  {
    accessorKey: "created_at",
    header: head("First seen"),
    cell: ({ row }) => (
      <span className="pl-4">
        {formatDistanceToNow(new Date(row.original.created_at), {
          addSuffix: true,
        })}
      </span>
    ),
  },
];

export default function SegmentMembers({
  projectId,
  segmentId,
  resultId,
  onExpired,
  computing = false,
}: {
  projectId: string;
  segmentId: string;
  resultId: string | undefined;
  onExpired: () => void;
  computing?: boolean;
}) {
  const [term, setTerm] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);
  const [open, setOpen] = useState<{ id: string } | null>(null);
  const query = useSegmentMembersQuery(projectId, segmentId, resultId, q);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage)
          void fetchNextPage();
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const expired = query.error instanceof ApiError && query.error.status === 410;
  const { recovering, reload } = useRecoverExpiredResult(
    expired,
    resultId,
    computing,
    onExpired
  );
  if (recovering)
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> The result expired;
        recomputing the segment, this takes a few seconds on large projects…
      </p>
    );
  if (expired)
    return (
      <div className="space-y-2">
        <SegmentError error={query.error} fallback="This result has expired." />
        <Button variant="outline" onClick={reload}>
          Reload
        </Button>
      </div>
    );
  if (query.isError)
    return (
      <SegmentError
        error={query.error}
        fallback="Could not load members."
        onRetry={() => void query.refetch()}
      />
    );
  const members = query.data?.pages.flatMap((p) => p.users) ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search identifier or device id"
            aria-label="Search members"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        {(computing || (!resultId && query.isPending)) && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Computing the segment
            first, this takes a few seconds on large projects…
          </span>
        )}
      </div>
      <DataTable
        columns={columns}
        data={members}
        selectedColumns={columns.map((c) => c.accessorKey as string)}
        getRowId={(m) => m.id}
        loading={query.isPending}
        hasFilters={q !== ""}
        ariaLabel="Segment members"
        onRowClick={(m) => setOpen({ id: m.id })}
        getRowAriaLabel={(m) => `Open ${m.sdk_identifier ?? m.uuid}`}
        emptyState={
          <p className="p-6 text-sm text-muted-foreground">
            {q
              ? `No members match “${q}”.`
              : "This segment has no members right now."}
          </p>
        }
        footerContent={
          <div
            ref={sentinel}
            className="py-2 text-center text-xs text-muted-foreground"
          >
            {hasNextPage || isFetchingNextPage ? (
              <Skeleton className="mx-auto h-4 w-32" />
            ) : members.length > 0 ? (
              "End of results"
            ) : null}
          </div>
        }
      />
      <AudienceItemDetailsDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
      />
    </div>
  );
}
