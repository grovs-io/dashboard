"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAnalyticsEventFieldValuesQuery } from "@/hooks/queries/useAnalyticsEventsQueries";
import { cn } from "@/lib/utils";
import { valueLabel } from "@ee/lib/segmentLabels";

export interface PickerOption {
  value: string;
  label: string;
}

interface Props {
  projectId: string;
  field: string;
  values: string[];
  onChange: (values: string[]) => void;
  ariaLabel: string;
  placeholder?: string;
  // The button's text once a multiple picker holds values.
  addLabel?: string;
  maxValues?: number;
  multiple?: boolean;
  allowCustom?: boolean;
  staticOptions?: PickerOption[];
  // Values never offered, even when recorded.
  exclude?: string[];
  labelOf?: (value: string) => string;
  className?: string;
}

export function useFieldOptions(
  projectId: string,
  field: string | undefined,
  term: string
) {
  const [debounced, setDebounced] = useState(term);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(t);
  }, [term]);
  const query = useAnalyticsEventFieldValuesQuery(
    projectId,
    field ? { field, q: debounced || undefined, limit: 50 } : undefined
  );
  const options = useMemo<PickerOption[]>(() => {
    const seen = new Set<string>();
    const out: PickerOption[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const v of page.values ?? []) {
        const value = typeof v === "string" ? v : String(v.id);
        const label =
          typeof v === "string" ? valueLabel(field ?? "", v) : v.name;
        if (!value || seen.has(value)) continue;
        seen.add(value);
        out.push({ value, label });
      }
    }
    return out;
  }, [query.data, field]);
  return {
    options,
    loading: query.isPending && !!field,
    hasMore: query.hasNextPage,
    fetchMore: query.fetchNextPage,
    error: query.isError,
  };
}

// Searchable multi-select over values the project has actually recorded (events field-values API).
export default function ValuePicker({
  projectId,
  field,
  values,
  onChange,
  ariaLabel,
  placeholder,
  addLabel = "add",
  maxValues = 100,
  multiple = true,
  allowCustom = false,
  staticOptions,
  exclude,
  labelOf,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const remote = useFieldOptions(
    projectId,
    staticOptions ? undefined : field,
    term
  );
  const options = useMemo(() => {
    const hidden = new Set(exclude ?? []);
    if (!staticOptions)
      return remote.options.filter((o) => !hidden.has(o.value));
    const t = term.trim().toLowerCase();
    return (
      t
        ? staticOptions.filter(
            (o) =>
              o.label.toLowerCase().includes(t) ||
              o.value.toLowerCase().includes(t)
          )
        : staticOptions
    ).filter((o) => !hidden.has(o.value));
  }, [staticOptions, remote.options, term, exclude]);
  const known = useMemo(
    () =>
      new Map(
        [...(staticOptions ?? []), ...remote.options].map((o) => [
          o.value,
          o.label,
        ])
      ),
    [staticOptions, remote.options]
  );
  const label = (v: string) =>
    labelOf?.(v) ?? known.get(v) ?? valueLabel(field, v);
  const customCandidate =
    allowCustom && term.trim() && !options.some((o) => o.value === term.trim())
      ? term.trim()
      : null;

  const toggle = (v: string) => {
    if (!multiple) {
      onChange([v]);
      setOpen(false);
      setTerm("");
      return;
    }
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else if (values.length < maxValues) onChange([...values, v]);
  };

  return (
    <div
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1",
        className
      )}
    >
      {multiple &&
        values.map((v) => (
          <span
            key={v}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-muted px-2 text-xs"
          >
            {label(v)}
            <button
              type="button"
              aria-label={`Remove ${label(v)}`}
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onChange(values.filter((x) => x !== v))}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      <Popover modal open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-8 font-normal",
              !multiple && "min-w-32 justify-between"
            )}
            aria-label={ariaLabel}
            aria-expanded={open}
          >
            {!multiple && values[0] !== undefined
              ? label(values[0])
              : multiple && values.length > 0
                ? addLabel
                : (placeholder ?? "choose…")}
            <ChevronDown className="size-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={16}
          className="flex max-h-[min(480px,var(--radix-popover-content-available-height))] w-64 flex-col overflow-hidden p-0"
        >
          <Command
            shouldFilter={false}
            className="flex min-h-0 flex-1 flex-col"
          >
            <CommandInput
              placeholder="Search…"
              value={term}
              onValueChange={setTerm}
            />
            <CommandList className="min-h-0 flex-1 overflow-y-auto">
              {remote.loading ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading values…
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    {remote.error
                      ? "Could not load values"
                      : customCandidate
                        ? "No recorded values"
                        : "No matches"}
                  </CommandEmpty>
                  <CommandGroup>
                    {customCandidate && (
                      <CommandItem
                        value={`__custom:${customCandidate}`}
                        onSelect={() => {
                          toggle(customCandidate);
                          setTerm("");
                        }}
                      >
                        Use “{customCandidate}”
                      </CommandItem>
                    )}
                    {options.map((o) => {
                      const selected = values.includes(o.value);
                      return (
                        <CommandItem
                          key={o.value}
                          value={o.value}
                          onSelect={() => toggle(o.value)}
                          aria-selected={selected}
                        >
                          <span
                            className={cn(
                              "mr-1 flex size-4 shrink-0 items-center justify-center rounded-sm border border-input",
                              selected && "border-primary bg-primary"
                            )}
                          >
                            {selected && (
                              <Check className="size-3 text-primary-foreground" />
                            )}
                          </span>
                          <span className="truncate">{o.label}</span>
                          {o.label !== o.value && (
                            <span className="ml-auto pl-2 text-[11px] text-muted-foreground">
                              {o.value}
                            </span>
                          )}
                        </CommandItem>
                      );
                    })}
                    {remote.hasMore && (
                      <CommandItem
                        value="__more"
                        onSelect={() => void remote.fetchMore()}
                        className="justify-center text-xs text-muted-foreground"
                      >
                        Load more
                      </CommandItem>
                    )}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
