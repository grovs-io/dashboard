"use client";

import { useState } from "react";
import type { SortType } from "@/types";
import type { AccessorKeyColumnDef } from "@tanstack/react-table";
import type { EventTableRow } from "./types";
import { countryName } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { renderSortableHeader } from "@/components/audience/VisitorsTableColumns";
import { formatPlatformName } from "@/lib/utils";
import { CirclePlus, CircleMinus, User } from "lucide-react";

/** Short form of a visitor UUID — matches the Audience table (`abcd1234…f0a1b2`). */
function truncateUuid(uuid: string): string {
  return uuid.length > 14 ? `${uuid.slice(0, 8)}…${uuid.slice(-6)}` : uuid;
}

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

function FilterableCell({
  field,
  value,
  displayValue,
  onCellFilter,
  extraActions,
  valueLabel,
}: {
  field: string;
  value: string;
  displayValue: React.ReactNode;
  onCellFilter: (
    field: string,
    value: string,
    op: "is" | "is_not" | "contains",
    displayValue?: string
  ) => void;
  extraActions?: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
  }[];
  valueLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  // What the Include/Exclude buttons show — defaults to the raw value, but the
  // caller can override (e.g. show the visitor uuid while filtering by numeric id).
  const label =
    valueLabel ??
    (field === "country"
      ? countryName(value)
      : field === "platform"
        ? formatPlatformName(value)
        : value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-left rounded px-1 -mx-1 hover:bg-accent/50 transition-colors cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          {displayValue}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto min-w-[160px] p-1"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors cursor-pointer"
          onClick={() => {
            onCellFilter(field, value, "is", valueLabel);
            setOpen(false);
          }}
        >
          <CirclePlus className="size-3.5 text-muted-foreground" />
          Include{" "}
          <span className="font-medium truncate max-w-[200px]">{label}</span>
        </button>
        <button
          className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors cursor-pointer"
          onClick={() => {
            onCellFilter(field, value, "is_not", valueLabel);
            setOpen(false);
          }}
        >
          <CircleMinus className="size-3.5 text-muted-foreground" />
          Exclude{" "}
          <span className="font-medium truncate max-w-[200px]">{label}</span>
        </button>
        {extraActions?.map((action) => (
          <button
            key={action.label}
            className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors cursor-pointer"
            onClick={() => {
              action.onClick();
              setOpen(false);
            }}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export const getEventsTableColumns = (
  sort: SortType,
  setSort: React.Dispatch<React.SetStateAction<SortType>>,
  onCellFilter?: (
    field: string,
    value: string,
    op: "is" | "is_not" | "contains",
    displayValue?: string
  ) => void,
  onOpenVisitor?: (visitorId: string) => void
): AccessorKeyColumnDef<EventTableRow>[] => {
  const filterable = (
    field: string,
    value: string,
    displayValue: React.ReactNode,
    extraActions?: {
      icon: React.ReactNode;
      label: string;
      onClick: () => void;
    }[],
    valueLabel?: string
  ) =>
    onCellFilter ? (
      <FilterableCell
        field={field}
        value={value}
        displayValue={displayValue}
        onCellFilter={onCellFilter}
        extraActions={extraActions}
        valueLabel={valueLabel}
      />
    ) : (
      displayValue
    );

  return [
    {
      accessorKey: "timestamp",
      header: () =>
        renderSortableHeader("Timestamp", "created_at", setSort, sort),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm whitespace-nowrap pl-2">
          {formatTimestamp(row.original.timestamp)}
        </span>
      ),
    },
    {
      accessorKey: "event_name",
      header: "Event Name",
      cell: ({ row }) => {
        // event_name falls back to event_type for system events;
        // filter by the correct backend field
        const isSystemEvent =
          row.original.event_name === row.original.event_type;
        const filterField = isSystemEvent ? "event_type" : "event_name";
        return filterable(
          filterField,
          row.original.event_name,
          <span className="font-medium">{row.original.event_name}</span>
        );
      },
    },
    {
      accessorKey: "user_id",
      header: "User",
      cell: ({ row }) => {
        const uuid = row.original.visitor_uuid;
        const navId =
          row.original.resolved_visitor_id ??
          (row.original.user_id ? Number(row.original.user_id) : null);
        const canLink = !!uuid && !!navId && navId > 0 && !!onOpenVisitor;
        const display = uuid ? truncateUuid(uuid) : row.original.user_id || "—";
        return filterable(
          "visitor_id",
          row.original.user_id,
          <span className="font-mono text-xs">{display}</span>,
          canLink
            ? [
                {
                  icon: <User className="size-3.5 text-muted-foreground" />,
                  label: "View visitor details",
                  onClick: () => onOpenVisitor!(String(navId)),
                },
              ]
            : undefined,
          uuid ? display : undefined
        );
      },
    },
    {
      accessorKey: "session_id",
      header: "Session",
      cell: ({ row }) =>
        filterable(
          "session_id",
          row.original.session_id,
          <span className="font-mono text-xs">{row.original.session_id}</span>
        ),
    },
    {
      accessorKey: "platform",
      header: "Platform",
      cell: ({ row }) =>
        filterable(
          "platform",
          row.original.platform,
          <Badge variant="outline" className="border-sidebar-border">
            {formatPlatformName(row.original.platform)}
          </Badge>
        ),
    },
    {
      accessorKey: "app_version",
      header: "Version",
      cell: ({ row }) =>
        filterable(
          "app_version",
          row.original.app_version,
          <span className="text-sm">{row.original.app_version}</span>
        ),
    },
    {
      accessorKey: "device_model",
      header: "Device",
      cell: ({ row }) =>
        filterable(
          "device_model",
          row.original.device_model,
          <span className="text-sm">{row.original.device_model}</span>
        ),
    },
    {
      accessorKey: "os_version",
      header: "OS",
      cell: ({ row }) =>
        filterable(
          "os_version",
          row.original.os_version,
          <span className="text-sm">{row.original.os_version}</span>
        ),
    },
    {
      accessorKey: "country",
      header: "Country",
      cell: ({ row }) =>
        filterable(
          "country",
          row.original.country,
          <span className="text-sm">{countryName(row.original.country)}</span>
        ),
    },
    {
      accessorKey: "city",
      header: "City",
      cell: ({ row }) =>
        filterable(
          "city",
          row.original.city,
          <span className="text-sm">{row.original.city}</span>
        ),
    },
  ];
};

export const DEFAULT_VISIBLE_COLUMNS = [
  "event_name",
  "timestamp",
  "user_id",
  "session_id",
  "platform",
  "app_version",
  "device_model",
  "os_version",
  "country",
  "city",
];

export const COLUMN_OPTIONS = [
  { label: "Event Name", value: "event_name" },
  { label: "Timestamp", value: "timestamp" },
  { label: "User", value: "user_id" },
  { label: "Session", value: "session_id" },
  { label: "Platform", value: "platform" },
  { label: "Version", value: "app_version" },
  { label: "Device", value: "device_model" },
  { label: "OS", value: "os_version" },
  { label: "Country", value: "country" },
  { label: "City", value: "city" },
];
