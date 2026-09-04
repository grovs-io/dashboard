"use client";

import { useMemo } from "react";
import {
  type AccessorKeyColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchX } from "lucide-react";

export interface DataTableProps<T> {
  columns: AccessorKeyColumnDef<T>[];
  data: T[];
  selectedColumns: string[];
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
  getRowAriaLabel?: (row: T) => string;
  loading?: boolean;
  hasFilters?: boolean;
  emptyState: React.ReactNode;
  ariaLabel: string;
  stickyHeader?: boolean;
  containerClassName?: string;
  headerClassName?: (columnId: string) => string | undefined;
  cellClassName?: (columnId: string) => string | undefined;
  skeletonCellClassName?: string;
  footerContent?: React.ReactNode;
}

const DataTable = <T,>({
  columns,
  data,
  selectedColumns,
  onRowClick,
  getRowId,
  getRowAriaLabel,
  loading,
  hasFilters,
  emptyState,
  ariaLabel,
  stickyHeader,
  containerClassName,
  headerClassName,
  cellClassName,
  skeletonCellClassName = "px-5 py-3",
  footerContent,
}: DataTableProps<T>) => {
  const visibleColumns = useMemo(() => {
    return columns.reduce(
      (acc, col) => {
        const key = col.accessorKey as string;
        if (key) acc[key] = selectedColumns.includes(key);
        return acc;
      },
      {} as Record<string, boolean>
    );
  }, [columns, selectedColumns]);

  const table = useReactTable({
    data,
    columns,
    ...(getRowId ? { getRowId } : {}),
    state: {
      columnVisibility: visibleColumns,
    },
    getCoreRowModel: getCoreRowModel(),
  });

  const defaultContainerClass =
    "rounded-md border overflow-hidden border-sidebar-border";

  return (
    <div
      className={cn("relative", containerClassName ?? defaultContainerClass)}
      aria-live="polite"
      aria-atomic="true"
    >
      <Table aria-label={ariaLabel}>
        <TableHeader className={stickyHeader ? "sticky top-0 z-10" : undefined}>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-table-header w-auto">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    stickyHeader
                      ? "bg-table-header text-foreground p-2"
                      : "text-foreground p-2",
                    headerClassName?.(header.column.id)
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading && !data?.length ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow
                key={`skeleton-${i}`}
                className="bg-background border-sidebar-border"
              >
                {table.getVisibleFlatColumns().map((col) => (
                  <TableCell key={col.id} className={skeletonCellClassName}>
                    <Skeleton className="h-4 w-3/4" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={
                  onRowClick && getRowAriaLabel
                    ? getRowAriaLabel(row.original)
                    : undefined
                }
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row.original);
                        }
                      }
                    : undefined
                }
                className={cn(
                  "bg-background border-sidebar-border",
                  onRowClick && "cursor-pointer",
                  loading && "opacity-70 pointer-events-none"
                )}
                onClick={
                  onRowClick ? () => onRowClick(row.original) : undefined
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      skeletonCellClassName,
                      cellClassName?.(cell.column.id)
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : hasFilters ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="h-[calc(100vh-300px)]"
              >
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <SearchX className="size-10 text-muted-foreground/40" />
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      No results found
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Try adjusting your search or filters
                    </p>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="p-0 whitespace-normal"
              >
                {emptyState}
              </TableCell>
            </TableRow>
          )}
          {footerContent && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="p-0">
                {footerContent}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default DataTable;
