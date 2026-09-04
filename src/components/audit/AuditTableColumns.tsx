"use client";

import type { AccessorKeyColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

export interface AuditTableRow {
  id: string;
  sequence: number;
  timestamp: string;
  action: string;
  actor: string;
  actorType: string;
  target: string;
  outcome: string;
  ip: string;
}

export const COLUMN_OPTIONS = [
  { label: "Time", value: "timestamp" },
  { label: "Action", value: "action" },
  { label: "Actor", value: "actor" },
  { label: "Target", value: "target" },
  { label: "Outcome", value: "outcome" },
  { label: "IP", value: "ip" },
  { label: "Seq", value: "sequence" },
];

export const DEFAULT_VISIBLE_COLUMNS = [
  "timestamp",
  "action",
  "actor",
  "target",
  "outcome",
];

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  );
}

const outcomeDot: Record<string, string> = {
  success: "bg-emerald-500",
  failure: "bg-destructive",
  pending: "bg-amber-500",
};

export function getAuditTableColumns(): AccessorKeyColumnDef<AuditTableRow>[] {
  return [
    {
      accessorKey: "timestamp",
      header: () => <span className="text-xs">Time</span>,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatTimestamp(row.original.timestamp)}
        </span>
      ),
    },
    {
      accessorKey: "action",
      header: () => <span className="text-xs">Action</span>,
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.action}</span>
      ),
    },
    {
      accessorKey: "actor",
      header: () => <span className="text-xs">Actor</span>,
      cell: ({ row }) => (
        <span className="text-xs truncate block max-w-[240px]">
          {row.original.actor}
        </span>
      ),
    },
    {
      accessorKey: "target",
      header: () => <span className="text-xs">Target</span>,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground truncate block max-w-[220px]">
          {row.original.target || "—"}
        </span>
      ),
    },
    {
      accessorKey: "outcome",
      header: () => <span className="text-xs">Outcome</span>,
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "size-1.5 rounded-full shrink-0",
              outcomeDot[row.original.outcome] ?? "bg-muted-foreground/40"
            )}
          />
          {row.original.outcome}
        </span>
      ),
    },
    {
      accessorKey: "ip",
      header: () => <span className="text-xs">IP</span>,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.ip || "—"}
        </span>
      ),
    },
    {
      accessorKey: "sequence",
      header: () => <span className="text-xs">Seq</span>,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          #{row.original.sequence}
        </span>
      ),
    },
  ];
}
