"use client";
import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  useLinksByIdsQuery,
  useLinksLookupQuery,
} from "@/hooks/queries/useLinksQueries";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";
import type { Link } from "@/types";

const LOOKUP_LIMIT = 20;

// link_id is the raw numeric id the links API returns, not a hashid.
export function useSelectedLink(projectId: string, linkId: number | null) {
  const ids = linkId != null ? { ids: [String(linkId)] } : null;
  const query = useLinksByIdsQuery(projectId, ids);
  const link = query.data?.find((l) => String(l.id) === String(linkId));
  return { link, loading: linkId != null && query.isPending };
}

interface Props {
  projectId: string;
  value: number | null;
  onChange: (linkId: number | null) => void;
}

export default function DeepLinkSelect({ projectId, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { link: selected } = useSelectedLink(projectId, value);

  const term = useDebouncedValue(search.trim(), 300);

  const links = useLinksLookupQuery(
    projectId,
    open ? { term: term || undefined, limit: LOOKUP_LIMIT } : null
  );

  const pick = (link: Link | null) => {
    onChange(link ? Number(link.id) : null);
    setOpen(false);
  };

  const status = links.isError
    ? "Could not load links."
    : links.isPending
      ? "Loading links…"
      : links.data?.length === 0
        ? "No link found."
        : null;

  const label =
    value == null ? "No link" : (selected?.name ?? `Link #${value}`);

  return (
    // Modal, so its list scrolls inside a dialog's scroll lock.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Deep link"
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search links…"
            className="h-9"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandGroup>
              <CommandItem value="__none__" onSelect={() => pick(null)}>
                <Check
                  className={cn(
                    "size-3.5",
                    value == null ? "opacity-100" : "opacity-0"
                  )}
                />
                No link
              </CommandItem>
              {(links.data ?? []).map((link) => (
                <CommandItem
                  key={link.id}
                  value={String(link.id)}
                  onSelect={() => pick(link)}
                >
                  <Check
                    className={cn(
                      "size-3.5",
                      String(link.id) === String(value)
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{link.name || link.path}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {link.path}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            {status && (
              <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                {links.isPending && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                {status}
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
