"use client";
import { useMemo, useState } from "react";
import { sub } from "date-fns";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectSelection } from "@/context/useProjectSelection";
import { retentionMinDate } from "@/lib/analyticsLimits";
import { formatApiStartOfDay, formatShortDate } from "@/lib/dateUtils";
import { useVisitorsQuery } from "@/hooks/queries/useVisitorsQueries";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { GetVisitorsParams, Visitor } from "@/types";

const PER_PAGE = 25;
// Mirrors AnalyticsRetentionGate::DEFAULT_START_DAYS: the backend 422s an older start_date.
const NO_RETENTION_INFO_FLOOR_DAYS = 30;

export interface AddFromVisitorsResult {
  added: string[];
  skipped: number;
}

export interface AddFromVisitorsDialogProps {
  projectId: string;
  mode: "identifiers" | "visitors";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (result: AddFromVisitorsResult) => void;
}

export default function AddFromVisitorsDialog({
  projectId,
  mode,
  open,
  onOpenChange,
  onAdd,
}: AddFromVisitorsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <VisitorsPicker
          projectId={projectId}
          mode={mode}
          onCancel={() => onOpenChange(false)}
          onAdd={onAdd}
        />
      </DialogContent>
    </Dialog>
  );
}

// Mounted only while the dialog is open, so closing it resets the search and selection.
function VisitorsPicker({
  projectId,
  mode,
  onCancel,
  onAdd,
}: Pick<AddFromVisitorsDialogProps, "projectId" | "mode" | "onAdd"> & {
  onCancel: () => void;
}) {
  const { selectedInstance } = useProjectSelection();
  const [term, setTerm] = useState("");
  // Keyed by visitor id so a selection made on one page survives moving to the next.
  const [selected, setSelected] = useState<Map<string, Visitor>>(new Map());

  const q = useDebouncedValue(term.trim(), 300);
  const [paging, setPaging] = useState({ q: "", page: 1 });
  const page = paging.q === q ? paging.page : 1;

  // No date picker here: the floor is the plan's whole queryable window (there is no "all time").
  const startDate = useMemo(() => {
    const now = new Date();
    return formatApiStartOfDay(
      retentionMinDate(selectedInstance?.analytics_retention, now) ??
        sub(now, { days: NO_RETENTION_INFO_FLOOR_DAYS })
    );
  }, [selectedInstance]);

  const params: GetVisitorsParams = {
    ascending: false,
    page,
    per_page: PER_PAGE,
    sort_by: "updated_at",
    start_date: startDate,
    ...(q ? { term: q } : {}),
  };

  const query = useVisitorsQuery(projectId, params);
  const visitors = query.data?.visitors ?? [];
  const totalPages = query.data?.totalPages ?? 0;

  const toggle = (visitor: Visitor) => {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(visitor.id)) next.delete(visitor.id);
      else next.set(visitor.id, visitor);
      return next;
    });
  };

  const handleAdd = () => {
    const added: string[] = [];
    let skipped = 0;
    for (const visitor of selected.values()) {
      if (mode === "identifiers") {
        if (visitor.sdk_identifier) added.push(visitor.sdk_identifier);
        else skipped += 1;
      } else {
        added.push(visitor.uuid);
      }
    }
    onAdd({ added, skipped });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add from visitors</DialogTitle>
        <DialogDescription>
          {mode === "identifiers"
            ? "Appends each selected visitor's user id; visitors without one are skipped."
            : "Appends each selected visitor's device id."}
        </DialogDescription>
      </DialogHeader>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search visitor"
          aria-label="Search visitors"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      <div className="max-h-80 overflow-auto rounded-md border border-sidebar-border">
        <Table aria-label="Visitors">
          <TableHeader>
            <TableRow className="bg-table-header">
              <TableHead className="w-10 p-2" />
              <TableHead className="p-2 text-foreground">ID</TableHead>
              <TableHead className="p-2 text-foreground">Identifier</TableHead>
              <TableHead className="p-2 text-foreground">Platform</TableHead>
              <TableHead className="p-2 text-foreground">Last seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isPending ? (
              <TableRow className="bg-background border-sidebar-border">
                <TableCell colSpan={5} className="p-4">
                  <Skeleton className="h-20 w-full" />
                </TableCell>
              </TableRow>
            ) : visitors.length === 0 ? (
              <TableRow className="bg-background border-sidebar-border">
                <TableCell
                  colSpan={5}
                  className="p-4 text-center text-muted-foreground"
                >
                  No visitors match.
                </TableCell>
              </TableRow>
            ) : (
              visitors.map((visitor) => (
                <TableRow
                  key={visitor.id}
                  className="bg-background border-sidebar-border"
                >
                  <TableCell className="p-2">
                    <Checkbox
                      checked={selected.has(visitor.id)}
                      onCheckedChange={() => toggle(visitor)}
                      aria-label={`Select ${visitor.sdk_identifier || visitor.uuid}`}
                    />
                  </TableCell>
                  <TableCell className="p-2 font-mono text-xs">
                    {visitor.uuid}
                  </TableCell>
                  <TableCell className="p-2">
                    {visitor.sdk_identifier || (
                      <span className="text-muted-foreground">none</span>
                    )}
                  </TableCell>
                  <TableCell className="p-2">{visitor.platform}</TableCell>
                  <TableCell className="p-2">
                    {formatShortDate(visitor.updated_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{selected.size} selected</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPaging({ q, page: page - 1 })}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page}
            {totalPages ? ` of ${totalPages}` : ""}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={query.isPending || page >= totalPages}
            onClick={() => setPaging({ q, page: page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={selected.size === 0}
          onClick={handleAdd}
        >
          Add {selected.size || ""}
        </Button>
      </DialogFooter>
    </>
  );
}
