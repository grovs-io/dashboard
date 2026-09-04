"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Filter } from "lucide-react";
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
import {
  AUDIT_ACTION_GROUPS,
  formatAuditAction,
} from "@/constants/auditActions";
import { cn } from "@/lib/utils";

export default function AuditActionCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label="Filter by action"
          className="shrink-0 gap-1.5 justify-between min-w-[180px]"
        >
          <span className="flex items-center gap-1.5 truncate">
            <Filter className="size-3.5 shrink-0" />
            <span className="truncate">
              {value ? formatAuditAction(value) : "All actions"}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search actions…" className="h-9" />
          <CommandList>
            <CommandEmpty>No action found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="All actions"
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "size-3.5",
                    value === "" ? "opacity-100" : "opacity-0"
                  )}
                />
                All actions
              </CommandItem>
            </CommandGroup>
            {AUDIT_ACTION_GROUPS.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.actions.map((action) => (
                  <CommandItem
                    key={action}
                    // Underscores/dots split so "member added" also matches.
                    value={`${action} ${action.replace(/[._]/g, " ")}`}
                    onSelect={() => {
                      onChange(action);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "size-3.5",
                        value === action ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="font-mono text-xs truncate">{action}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
