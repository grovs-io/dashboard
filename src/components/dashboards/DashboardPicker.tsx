"use client";

import { useId, useState, type ReactNode } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  Check,
  ChevronDown,
  LayoutGrid,
  Plus,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Dashboard } from "@/types";
import { BUILTIN_DASHBOARDS, builtinDashboard } from "./builtinDashboards";

export const MAX_DASHBOARDS = 10;
/** From this many boards the list gets a search box. */
const SEARCH_FROM = 7;

const time = (iso: string) => new Date(iso).getTime() || 0;

/** "6 widgets · edited 2 days ago"; widget edits count, since they don't touch the board. */
export function boardMeta(d: Dashboard, now = new Date()): string {
  const n = d.widgets.length;
  if (n === 0) return "No widgets yet";
  const count = n === 1 ? "1 widget" : `${n} widgets`;
  const created = time(d.created_at);
  const edited = Math.max(
    time(d.updated_at),
    ...d.widgets.map((w) => time(w.updated_at))
  );
  if (!edited) return count;
  if (created && edited - created < 60_000)
    return `${count} · created ${format(created, "d MMM")}`;
  if (now.getTime() - edited < 60_000) return `${count} · edited just now`;
  return `${count} · edited ${formatDistanceToNowStrict(edited, { addSuffix: true })}`;
}

function Row({
  value,
  icon: Icon,
  title,
  meta,
  selected,
}: {
  value: string;
  icon: LucideIcon;
  title: string;
  meta: ReactNode;
  selected: boolean;
}) {
  const id = useId();
  return (
    // Raw Radix item: the shadcn one forces pl-8 and a circle indicator.
    <DropdownMenuPrimitive.RadioItem
      value={value}
      title={title}
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-m`}
      className="flex cursor-default items-center gap-3 rounded-md px-2 py-1.5 outline-hidden select-none focus:bg-muted data-[state=checked]:bg-muted"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-muted/60">
        <Icon className="size-4 text-muted-foreground" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span id={`${id}-t`} className="truncate text-sm font-medium">
          {title}
        </span>
        <span id={`${id}-m`} className="truncate text-xs text-muted-foreground">
          {meta}
        </span>
      </span>
      {selected && (
        <Check className="size-4 shrink-0 text-[var(--chart-users)]" />
      )}
    </DropdownMenuPrimitive.RadioItem>
  );
}

export function DashboardPicker({
  dashboards,
  active,
  onSelect,
  onCreate,
}: {
  dashboards: Dashboard[];
  /** A built-in key ("" = Overview) or a dashboard id as a string (the `board` URL param). */
  active: string;
  onSelect: (value: string) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const builtin = builtinDashboard(active);
  const activeDashboard = builtin
    ? undefined
    : dashboards.find((d) => String(d.id) === active);
  const value = builtin || activeDashboard ? active : "";
  const current =
    builtin ?? (activeDashboard ? undefined : BUILTIN_DASHBOARDS[0]);
  const TriggerIcon = current?.icon ?? LayoutGrid;
  const atLimit = dashboards.length >= MAX_DASHBOARDS;
  const searchable = dashboards.length >= SEARCH_FROM;
  const q = query.trim().toLowerCase();
  const boards = q
    ? dashboards.filter((d) => d.name.toLowerCase().includes(q))
    : dashboards;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu onOpenChange={(open) => !open && setQuery("")}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            aria-label="Choose dashboard"
            className="h-9 gap-2 border-none bg-secondary text-secondary-foreground shadow-none"
          >
            <TriggerIcon className="size-4" />
            <span className="truncate max-w-[240px] text-sm font-medium">
              {current ? current.name : activeDashboard?.name}
            </span>
            <ChevronDown className="size-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[360px] max-w-[calc(100vw-2rem)] p-1.5"
        >
          <DropdownMenuRadioGroup value={value} onValueChange={onSelect}>
            <DropdownMenuLabel className="px-2 text-xs font-normal text-muted-foreground">
              Built-in
            </DropdownMenuLabel>
            {BUILTIN_DASHBOARDS.map((d) => (
              <Row
                key={d.key || "overview"}
                value={d.key}
                icon={d.icon}
                title={d.name}
                meta={d.description}
                selected={value === d.key}
              />
            ))}
            {dashboards.length > 0 && (
              <>
                <DropdownMenuSeparator className="my-1.5" />
                <DropdownMenuLabel className="flex items-center justify-between px-2 text-xs font-normal text-muted-foreground">
                  <span>Your boards</span>
                  <span className="tabular-nums">
                    {dashboards.length}/{MAX_DASHBOARDS}
                  </span>
                </DropdownMenuLabel>
                {searchable && (
                  <div className="relative mx-1 mb-1">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      // Keeps the menu's typeahead from taking the keystrokes.
                      onKeyDown={(e) => {
                        if (e.key !== "Escape") e.stopPropagation();
                      }}
                      placeholder="Find a board"
                      aria-label="Find a board"
                      className="h-8 border-sidebar-border bg-background pr-2 pl-8 text-sm shadow-none focus-visible:border-sidebar-border focus-visible:ring-2 focus-visible:ring-[var(--chart-users)]/30 md:text-sm dark:bg-background"
                    />
                  </div>
                )}
                <div
                  className={
                    searchable ? "max-h-[240px] overflow-y-auto" : undefined
                  }
                >
                  {boards.map((d) => (
                    <Row
                      key={d.id}
                      value={String(d.id)}
                      icon={LayoutGrid}
                      title={d.name}
                      meta={boardMeta(d)}
                      selected={value === String(d.id)}
                    />
                  ))}
                  {boards.length === 0 && (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
                      No boards match “{query.trim()}”
                    </p>
                  )}
                </div>
              </>
            )}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator className="my-1.5" />
          <DropdownMenuItem
            onSelect={onCreate}
            disabled={atLimit}
            className="px-2 text-[color:var(--chart-users)] focus:text-[color:var(--chart-users)]"
          >
            <Plus className="size-4 text-[color:var(--chart-users)]" />
            New board
          </DropdownMenuItem>
          {atLimit && (
            <DropdownMenuLabel className="px-2 text-xs font-normal text-muted-foreground">
              {`Limit of ${MAX_DASHBOARDS} dashboards reached`}
            </DropdownMenuLabel>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
