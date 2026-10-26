"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { numberFormatter } from "@/components/analytics/overview/metricFormat";
import { bucketLabel, OTHER_KEY } from "@/lib/metricQuery";
import { DeltaPill } from "./NumberWidget";
import type { RowClickHandler, WidgetData } from "./types";

export function TableWidget({
  data,
  onRowClick,
}: {
  data: WidgetData;
  onRowClick?: RowClickHandler;
}) {
  const rows =
    data.other && data.other.value > 0 ? [...data.rows, data.other] : data.rows;
  const total = Math.max(data.total.value, 1);
  const hasPrevious = rows.some((r) => r.previous != null);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Value</TableHead>
          <TableHead className="text-right">Count</TableHead>
          <TableHead className="text-right">Share</TableHead>
          {hasPrevious && (
            <TableHead className="text-right">vs previous</TableHead>
          )}
          {onRowClick && <TableHead className="w-6" aria-hidden />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const isOther = r.key === OTHER_KEY;
          const label = isOther ? "Other" : bucketLabel(data.group_by, r);
          const clickable = onRowClick && !isOther;
          return (
            <TableRow
              key={r.key}
              className={cn(
                clickable &&
                  "group cursor-pointer hover:border-transparent hover:bg-transparent has-[+tr:hover]:border-transparent [&:hover>td]:bg-muted dark:[&:hover>td]:bg-muted/60 [&>td:first-child]:rounded-l-md [&>td:last-child]:rounded-r-md"
              )}
              onClick={clickable ? () => onRowClick(r.key, label) : undefined}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              aria-label={clickable ? label : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        if (e.key === " ") e.preventDefault();
                        onRowClick(r.key, label);
                      }
                    }
                  : undefined
              }
            >
              <TableCell
                className={isOther ? "text-muted-foreground" : "font-medium"}
              >
                {label}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {numberFormatter.format(r.value)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {Math.round((r.value / total) * 100)}%
              </TableCell>
              {hasPrevious && (
                <TableCell className="text-right">
                  <DeltaPill current={r.value} previous={r.previous} />
                </TableCell>
              )}
              {onRowClick && (
                <TableCell className="w-6 pl-0 text-right">
                  {clickable && (
                    <ChevronRight
                      aria-hidden
                      className="ml-auto size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                    />
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
