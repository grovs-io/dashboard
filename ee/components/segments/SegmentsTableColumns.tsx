"use client";
import type { AccessorKeyColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import type { Segment } from "@ee/types/segments";

export interface SegmentRowActions {
  onEdit: (segment: Segment) => void;
  onExport: (segment: Segment) => void;
  onArchive: (segment: Segment) => void;
  onRestore: (segment: Segment) => void;
}

const header = (label: string) => (
  <Button variant="ghost" tabIndex={-1}>
    {label}
  </Button>
);
const number = (value: number) => value.toLocaleString();

const Size = ({
  segment,
  field,
}: {
  segment: Segment;
  field: "persons" | "devices";
}) =>
  segment.size ? (
    <span className="tabular-nums">{number(segment.size[field])}</span>
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="text-muted-foreground"
          aria-label="Size not computed yet"
        >
          —
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Updated daily. Open the segment for a live count.
      </TooltipContent>
    </Tooltip>
  );

export function getSegmentsTableColumns(
  actions: SegmentRowActions
): AccessorKeyColumnDef<Segment>[] {
  const columns: AccessorKeyColumnDef<Segment>[] = [
    {
      accessorKey: "name",
      header: () => header("Name"),
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          {row.original.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {row.original.description}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "persons",
      header: () => header("People"),
      cell: ({ row }) => <Size segment={row.original} field="persons" />,
    },
    {
      accessorKey: "devices",
      header: () => header("Devices"),
      cell: ({ row }) => <Size segment={row.original} field="devices" />,
    },
    {
      accessorKey: "updated_at",
      header: () => header("Updated"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDistanceToNow(new Date(row.original.updated_at), {
            addSuffix: true,
          })}
        </span>
      ),
    },
  ];
  columns.push({
    accessorKey: "id",
    header: () => null,
    cell: ({ row }) => {
      const segment = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${segment.name}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {!segment.archived && (
              <DropdownMenuItem onSelect={() => actions.onEdit(segment)}>
                Edit
              </DropdownMenuItem>
            )}
            {!segment.archived && (
              <DropdownMenuItem onSelect={() => actions.onExport(segment)}>
                Export CSV
              </DropdownMenuItem>
            )}
            {segment.archived ? (
              <DropdownMenuItem onSelect={() => actions.onRestore(segment)}>
                Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => actions.onArchive(segment)}>
                Archive
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  });
  return columns;
}
