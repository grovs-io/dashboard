"use client";
import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSegmentsQuery } from "@ee/hooks/queries/useSegmentsQueries";
import SegmentDialog from "@ee/components/segments/SegmentDialog";
import { SegmentError } from "@ee/components/segments/SegmentNotices";
import type { Segment } from "@ee/types/segments";

const sizeLabel = (segment: Segment) =>
  segment.size
    ? `${segment.size.persons.toLocaleString()} people`
    : "size pending";

// Options are keyed by id (names can repeat), so search looks at the name keyword only.
const matchName = (_value: string, search: string, keywords?: string[]) =>
  (keywords ?? []).some((k) => k.toLowerCase().includes(search.toLowerCase()))
    ? 1
    : 0;

export interface SegmentSelectProps {
  projectId: string;
  value: string | undefined;
  onChange: (segmentId: string | undefined) => void;
}

export default function SegmentSelect({
  projectId,
  value,
  onChange,
}: SegmentSelectProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Segment | null>(null);
  const query = useSegmentsQuery(projectId, false);

  const newButton = (
    <Button
      type="button"
      variant="outline"
      className="self-start"
      onClick={() => setCreating(true)}
    >
      <Plus className="size-3.5" />
      New segment
    </Button>
  );
  const dialog = (
    <SegmentDialog
      open={creating}
      onOpenChange={setCreating}
      projectId={projectId}
      onSaved={(segment) => {
        setCreating(false);
        setCreated(segment);
        onChange(segment.id);
      }}
    />
  );

  if (query.isError)
    return (
      <SegmentError
        error={query.error}
        fallback="Could not load segments."
        onRetry={() => void query.refetch()}
      />
    );

  if (query.isPending) return <Skeleton className="h-9 w-64" />;

  const listed = query.data?.segments ?? [];
  // A just-created segment shows before the list refetch brings it back.
  const segments =
    created && !listed.some((s) => s.id === created.id)
      ? [...listed, created]
      : listed;

  if (segments.length === 0)
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-sidebar-border p-4">
        <p className="text-sm text-muted-foreground">
          This project has no segments yet.
        </p>
        {newButton}
        {dialog}
      </div>
    );

  const selected = segments.find((segment) => segment.id === value);

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select a segment"
            className="min-w-0 flex-1 justify-between font-normal"
          >
            <span className="truncate">
              {selected ? selected.name : "Select a segment"}
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command filter={matchName}>
            <CommandInput placeholder="Search segments…" className="h-9" />
            <CommandList>
              <CommandEmpty>No segment found.</CommandEmpty>
              <CommandGroup>
                {segments.map((segment) => (
                  <CommandItem
                    key={segment.id}
                    value={segment.id}
                    keywords={[segment.name]}
                    onSelect={() => {
                      onChange(segment.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "size-3.5",
                        value === segment.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                      <span className="truncate">{segment.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {sizeLabel(segment)}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {newButton}
      {dialog}
    </div>
  );
}
