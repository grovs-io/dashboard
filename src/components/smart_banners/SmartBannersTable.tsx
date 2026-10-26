"use client";
import type {
  ComponentProps,
  KeyboardEvent,
  ReactElement,
  ReactNode,
} from "react";
import { GripVertical, MoreHorizontal, SearchX } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BANNER_ACTIONS,
  dismissRate,
  formatCtr,
  moveId,
  moveToEdge,
  type SmartBannerAction,
} from "@/lib/smartBanners";
import { cn } from "@/lib/utils";
import type { SmartBanner } from "@/types";
import { SmartBannerStatusButton } from "./SmartBannerStatusPill";

export interface SmartBannerRowActions {
  onOpen: (banner: SmartBanner) => void;
  onAction: (banner: SmartBanner, action: SmartBannerAction) => void;
}

interface Props {
  banners: SmartBanner[];
  // Ids of every non-archived banner, top priority first.
  order: number[];
  loading: boolean;
  actions: SmartBannerRowActions;
  onReorder: (ids: number[]) => void;
  reorderPending?: boolean;
  // A search or filter is on: rows are a subset, so priority can't be set.
  filtered?: boolean;
  // Off in the Archived view, where banners have no priority.
  showPriority?: boolean;
  emptyState: ReactNode;
}

const STATS = [
  ["views", "Views"],
  ["clicks", "Clicks"],
  ["ctr", "CTR"],
  ["dismisses", "Dismisses"],
  ["dismissRate", "Dismiss rate"],
  ["installs", "Installs"],
] as const;
// Cell and header styles of the shared DataTable, as on the Links page.
const CELL = "p-2";
const INNER = "px-3";
const HEAD = "bg-table-header p-2 text-foreground";
export const REORDER_LOCKED_HINT = "Clear the search and filters to reorder";
export const PRIORITY_HINT =
  "When several banners match a page, the one with the highest priority is shown.";

const LABELS: Record<SmartBannerAction, string> = {
  publish: "Publish",
  pause: "Pause",
  resume: "Resume",
  edit: "Edit",
  duplicate: "Duplicate",
  archive: "Archive",
  restore: "Restore",
  delete: "Delete",
};

const header = (label: string) => (
  <span className="inline-flex h-9 items-center px-4 font-medium">{label}</span>
);

export function buildAnnouncements(banners: SmartBanner[]): Announcements {
  const nameById = new Map(banners.map((b) => [b.id, b.name]));
  const label = (id: string | number) => nameById.get(Number(id)) ?? String(id);
  return {
    onDragStart: ({ active }) =>
      `Picked up draggable item ${label(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `Draggable item ${label(active.id)} was moved over droppable area ${label(over.id)}.`
        : `Draggable item ${label(active.id)} is no longer over a droppable area.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Draggable item ${label(active.id)} was dropped over droppable area ${label(over.id)}`
        : `Draggable item ${label(active.id)} was dropped.`,
    onDragCancel: ({ active }) =>
      `Dragging was cancelled. Draggable item ${label(active.id)} was dropped.`,
  };
}

interface MoveState {
  order: number[];
  locked: boolean;
  onReorder: (ids: number[]) => void;
}

function MoveItem({
  banner,
  edge,
  move,
}: {
  banner: SmartBanner;
  edge: "top" | "bottom";
  move: MoveState;
}) {
  const at = move.order.indexOf(banner.id);
  const there = edge === "top" ? at === 0 : at === move.order.length - 1;
  const item = (
    <DropdownMenuItem
      disabled={move.locked || there || at < 0}
      onSelect={() => move.onReorder(moveToEdge(move.order, banner.id, edge))}
    >
      {edge === "top" ? "Move to top" : "Move to bottom"}
    </DropdownMenuItem>
  );
  if (!move.locked) return item;
  // A disabled item gets no pointer events, so the wrapper carries the tooltip.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>{item}</div>
      </TooltipTrigger>
      <TooltipContent side="left">{REORDER_LOCKED_HINT}</TooltipContent>
    </Tooltip>
  );
}

// Shared by the ⋯ button, the status pill and the editor header.
export function RowMenu({
  banner,
  actions,
  move,
  disabled,
  trigger,
  exclude = [],
}: {
  banner: SmartBanner;
  actions: SmartBannerRowActions;
  move: MoveState | null;
  disabled: boolean;
  trigger: ReactElement<ComponentProps<"button">>;
  exclude?: SmartBannerAction[];
}) {
  const list = BANNER_ACTIONS[banner.status].filter(
    (a) => !exclude.includes(a)
  );
  const item = (action: SmartBannerAction) => (
    <DropdownMenuItem
      key={action}
      variant={action === "delete" ? "destructive" : "default"}
      onSelect={() =>
        action === "edit"
          ? actions.onOpen(banner)
          : actions.onAction(banner, action)
      }
    >
      {LABELS[action]}
    </DropdownMenuItem>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        disabled={disabled}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {list.filter((a) => a !== "delete").map(item)}
        {move && (
          <>
            <DropdownMenuSeparator />
            <MoveItem banner={banner} edge="top" move={move} />
            <MoveItem banner={banner} edge="bottom" move={move} />
          </>
        )}
        {list.includes("delete") && (
          <>
            <DropdownMenuSeparator />
            {item("delete")}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Handle({
  banner,
  disabled,
  locked,
  handleProps,
}: {
  banner: SmartBanner;
  disabled: boolean;
  locked: boolean;
  handleProps: Record<string, unknown>;
}) {
  const button = (
    <button
      type="button"
      aria-label={`Reorder ${banner.name}`}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "flex cursor-grab items-center text-muted-foreground/60 hover:text-foreground disabled:opacity-50",
        locked ? "disabled:cursor-not-allowed" : "disabled:cursor-wait"
      )}
      {...handleProps}
    >
      <GripVertical className="size-4" />
    </button>
  );
  if (!locked) return button;
  // A disabled button gets no pointer events, so the wrapper carries the tooltip.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex"
          tabIndex={0}
          onClick={(e) => e.stopPropagation()}
        >
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent>{REORDER_LOCKED_HINT}</TooltipContent>
    </Tooltip>
  );
}

function Row({
  banner,
  actions,
  pending,
  move,
}: {
  banner: SmartBanner;
  actions: SmartBannerRowActions;
  pending: boolean;
  move: MoveState | null;
}) {
  const locked = move?.locked ?? true;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: banner.id,
    disabled: pending || locked,
  });
  // Archived banners can't be edited, only restored.
  const editable = banner.status !== "archived";
  const open = () => actions.onOpen(banner);
  return (
    <TableRow
      ref={setNodeRef}
      data-testid="smart-banner-row"
      data-name={banner.name}
      {...(editable && {
        role: "button",
        tabIndex: 0,
        "aria-label": `Open smart banner ${banner.name}`,
        onClick: open,
        onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        },
      })}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative border-sidebar-border bg-background",
        editable && "cursor-pointer",
        isDragging && "z-20 shadow-md"
      )}
    >
      {move && (
        <TableCell className="w-24 py-2 pl-4 pr-0">
          <div className="flex items-center gap-2">
            <Handle
              banner={banner}
              disabled={pending || locked}
              locked={locked}
              handleProps={{ ...attributes, ...listeners }}
            />
            <span
              data-testid="smart-banner-priority"
              className="tabular-nums text-muted-foreground"
            >
              {move.order.indexOf(banner.id) + 1}
            </span>
          </div>
        </TableCell>
      )}
      <TableCell className={cn(CELL, "max-w-[300px]")}>
        <div className={cn(INNER, "truncate")}>{banner.name}</div>
      </TableCell>
      <TableCell className={CELL}>
        <div className={INNER}>
          <RowMenu
            banner={banner}
            actions={actions}
            move={move}
            disabled={pending}
            trigger={<SmartBannerStatusButton banner={banner} />}
          />
        </div>
      </TableCell>
      <TableCell className={CELL}>
        <div className={INNER}>
          {banner.platforms
            .map((p) => (p === "ios" ? "iOS" : "Android"))
            .join(", ")}
        </div>
      </TableCell>
      <TableCell className={CELL}>
        <div className={cn(INNER, "capitalize")}>{banner.position}</div>
      </TableCell>
      {STATS.map(([key]) => {
        const rightAligned = key === "dismisses" || key === "dismissRate";
        if (key === "dismissRate") {
          const rate = dismissRate(banner.stats.dismisses, banner.stats.views);
          return (
            <TableCell key={key} className={CELL}>
              <p
                className={cn(
                  INNER,
                  "tabular-nums",
                  rightAligned && "text-right"
                )}
              >
                {rate === undefined ? "-" : formatCtr(rate)}
              </p>
            </TableCell>
          );
        }
        const raw = banner.stats[key];
        return (
          <TableCell key={key} className={CELL}>
            <p
              className={cn(
                INNER,
                "tabular-nums",
                rightAligned && "text-right"
              )}
            >
              {!raw
                ? "-"
                : key === "ctr"
                  ? formatCtr(raw)
                  : raw.toLocaleString()}
            </p>
          </TableCell>
        );
      })}
      <TableCell
        className={cn(
          CELL,
          "sticky right-0 z-[1] w-12 border-l border-sidebar-border bg-background text-right"
        )}
      >
        <RowMenu
          banner={banner}
          actions={actions}
          move={move}
          disabled={pending}
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Actions for ${banner.name}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
      </TableCell>
    </TableRow>
  );
}

// Same placeholder rows as the shared DataTable.
function SkeletonRow({ columns }: { columns: number }) {
  return (
    <TableRow className="border-sidebar-border bg-background">
      {Array.from({ length: columns }, (_, i) => (
        <TableCell key={i} className={CELL}>
          <Skeleton className="h-4 w-3/4" />
        </TableCell>
      ))}
    </TableRow>
  );
}

function NoResults({ columns }: { columns: number }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={columns} className="h-[calc(100vh-300px)]">
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <SearchX className="size-10 text-muted-foreground/40" />
          <div className="text-center">
            <p className="text-sm text-muted-foreground">No results found</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Try adjusting your search or filters
            </p>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

// Styled as the Links DataTable, with a handle to set the order.
export default function SmartBannersTable({
  banners,
  order,
  loading,
  actions,
  onReorder,
  reorderPending = false,
  filtered = false,
  showPriority = true,
  emptyState,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const ids = banners.map((b) => b.id);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(moveId(order, Number(active.id), Number(over.id)));
  };
  const columns = (showPriority ? 6 : 5) + STATS.length;
  const moveFor = (b: SmartBanner): MoveState | null =>
    showPriority && b.status !== "archived"
      ? { order, locked: filtered, onReorder }
      : null;

  return (
    <div
      aria-busy={loading}
      className="relative min-h-0 overflow-auto overscroll-none rounded-md border border-sidebar-border scrollbar-hide [&>[data-slot=table-container]]:overflow-visible"
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{ announcements: buildAnnouncements(banners) }}
      >
        <Table aria-label="Smart banners">
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="w-auto bg-table-header">
              {showPriority && (
                <TableHead className={cn(HEAD, "w-24 pl-4")}>
                  <span className="inline-flex h-9 items-center font-medium">
                    Priority
                  </span>
                </TableHead>
              )}
              <TableHead className={HEAD}>{header("Name")}</TableHead>
              <TableHead className={HEAD}>{header("Status")}</TableHead>
              <TableHead className={HEAD}>{header("Platforms")}</TableHead>
              <TableHead className={HEAD}>{header("Position")}</TableHead>
              {STATS.map(([key, label]) => (
                <TableHead
                  key={key}
                  className={cn(
                    HEAD,
                    (key === "dismisses" || key === "dismissRate") &&
                      "text-right"
                  )}
                >
                  {header(label)}
                </TableHead>
              ))}
              <TableHead
                className={cn(
                  HEAD,
                  "sticky right-0 z-[2] border-l border-sidebar-border"
                )}
              >
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }, (_, i) => (
                <SkeletonRow key={i} columns={columns} />
              ))
            ) : banners.length === 0 ? (
              filtered ? (
                <NoResults columns={columns} />
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={columns}
                    className="whitespace-normal p-0"
                  >
                    {emptyState}
                  </TableCell>
                </TableRow>
              )
            ) : (
              <SortableContext
                items={ids}
                strategy={verticalListSortingStrategy}
              >
                {banners.map((b) => (
                  <Row
                    key={b.id}
                    banner={b}
                    actions={actions}
                    pending={reorderPending}
                    move={moveFor(b)}
                  />
                ))}
              </SortableContext>
            )}
          </TableBody>
        </Table>
      </DndContext>
    </div>
  );
}
