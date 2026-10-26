"use client";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import {
  flexRender,
  type AccessorKeyColumnDef,
  type CellContext,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { MoreHorizontal, Plus, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import DataTable from "@/components/common/DataTable";
import { canEdit, canEnd, canPause, canResume } from "@ee/lib/journeys";
import type { JourneyAction, JourneyRow } from "@ee/types/journey";
import JourneyStatusPill from "./JourneyStatusPill";

export interface JourneyRowActions {
  onOpen: (journey: JourneyRow) => void;
  onEdit: (journey: JourneyRow) => void;
  onDuplicate: (journey: JourneyRow) => void;
  onStep: (journey: JourneyRow, action: JourneyAction) => void;
  onDelete: (journey: JourneyRow) => void;
}

// Actions come from context so the column defs stay stable across page re-renders.
const Actions = createContext<JourneyRowActions | null>(null);

const header = (label: string) => (
  <Button variant="ghost" tabIndex={-1}>
    {label}
  </Button>
);

function RowMenu({ journey }: { journey: JourneyRow }) {
  const actions = useContext(Actions);
  if (!actions) return null;
  const draft = journey.status === "draft";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${journey.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {!draft && (
          <DropdownMenuItem onSelect={() => actions.onOpen(journey)}>
            Open report
          </DropdownMenuItem>
        )}
        {canEdit(journey) && (
          <DropdownMenuItem onSelect={() => actions.onEdit(journey)}>
            Edit
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => actions.onDuplicate(journey)}>
          Duplicate
        </DropdownMenuItem>
        {canPause(journey) && (
          <DropdownMenuItem onSelect={() => actions.onStep(journey, "pause")}>
            Pause
          </DropdownMenuItem>
        )}
        {canResume(journey) && (
          <DropdownMenuItem onSelect={() => actions.onStep(journey, "resume")}>
            Resume
          </DropdownMenuItem>
        )}
        {canEnd(journey) && (
          <DropdownMenuItem onSelect={() => actions.onStep(journey, "end")}>
            End
          </DropdownMenuItem>
        )}
        {draft && (
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => actions.onDelete(journey)}
          >
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const number = (n: number | undefined, draft: boolean) =>
  draft ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <span className="tabular-nums">{(n ?? 0).toLocaleString()}</span>
  );

function columns(): AccessorKeyColumnDef<JourneyRow>[] {
  return [
    {
      accessorKey: "name",
      header: () => header("Name"),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "status",
      header: () => header("Status"),
      cell: ({ row }) => <JourneyStatusPill status={row.original.status} />,
    },
    {
      accessorKey: "entered",
      header: () => header("Entered"),
      cell: ({ row }) =>
        number(row.original.stats?.entered, row.original.status === "draft"),
    },
    {
      accessorKey: "active",
      header: () => header("Active now"),
      cell: ({ row }) =>
        number(row.original.stats?.active, row.original.status === "draft"),
    },
    {
      accessorKey: "launched_at",
      header: () => header("Live since"),
      cell: ({ row }) => {
        const { launched_at, start_at } = row.original;
        if (!launched_at)
          return <span className="text-muted-foreground">Not launched</span>;
        const from =
          start_at && new Date(start_at) > new Date(launched_at)
            ? start_at
            : launched_at;
        return (
          <span className="text-muted-foreground">
            {format(new Date(from), "MMM d, yyyy HH:mm")}
          </span>
        );
      },
    },
    {
      accessorKey: "id",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <RowMenu journey={row.original} />,
    },
  ];
}

const WAITING = "waiting-";
const waiting = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${WAITING}${i}`,
  })) as JourneyRow[];
const isWaiting = (j: JourneyRow) => j.id.startsWith(WAITING);
const SHAPES: Record<string, string> = {
  name: "h-4 w-36",
  status: "h-[22px] w-14 rounded-full",
  entered: "h-4 w-12",
  active: "h-4 w-12",
  launched_at: "h-4 w-32",
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
        <Route className="size-5 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-center text-sm font-semibold">
        No journeys yet
      </h3>
      <p className="mb-6 max-w-md text-center text-xs leading-relaxed text-muted-foreground">
        A journey moves each person through waits, splits, pushes and in-app
        messages, starting when they do something or join a segment.
      </p>
      <Button className="pl-3 pr-4" onClick={onCreate}>
        <Plus className="size-4" />
        New journey
      </Button>
    </div>
  );
}

export default function JourneysTable({
  journeys,
  loading,
  hasFilters,
  hasMore,
  loadingMore,
  onLoadMore,
  actions,
  onCreate,
}: {
  journeys: JourneyRow[];
  loading: boolean;
  hasFilters: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  actions: JourneyRowActions;
  onCreate: () => void;
}) {
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

  const cols = useMemo(
    () =>
      columns().map((column) => ({
        ...column,
        cell: (context: CellContext<JourneyRow, unknown>) =>
          isWaiting(context.row.original) ? (
            <Skeleton className={SHAPES[column.accessorKey as string]} />
          ) : (
            flexRender(column.cell, context)
          ),
      })),
    []
  );
  const rows = useMemo(
    () =>
      loading
        ? waiting(5)
        : loadingMore
          ? [...journeys, ...waiting(3)]
          : journeys,
    [journeys, loading, loadingMore]
  );
  return (
    <Actions.Provider value={actions}>
      <div aria-busy={loading || loadingMore}>
        <DataTable
          columns={cols}
          data={rows}
          isRowClickable={(j) => !isWaiting(j)}
          selectedColumns={cols.map((c) => c.accessorKey as string)}
          onRowClick={actions.onOpen}
          getRowId={(j) => j.id}
          getRowAriaLabel={(j) => `Open journey ${j.name}`}
          hasFilters={hasFilters}
          ariaLabel="Journeys"
          emptyState={<EmptyState onCreate={onCreate} />}
          footerContent={
            hasMore || loadingMore ? (
              <div ref={sentinel} className="h-px" />
            ) : undefined
          }
        />
      </div>
    </Actions.Provider>
  );
}
