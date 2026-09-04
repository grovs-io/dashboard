"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  X,
  Zap,
  Tag,
  User,
  Hash,
  Smartphone,
  Layers,
  GitBranch,
  Monitor,
  Globe,
  MapPin,
  Megaphone,
  Link,
  Equal,
  EqualNot,
  TextSearch,
  Braces,
  type LucideIcon,
} from "lucide-react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
  CommandSeparator,
} from "@/components/ui/command";
import { cn, countryName, formatPlatformName } from "@/lib/utils";
import {
  useAnalyticsEventFieldsQuery,
  useAnalyticsEventFieldValuesQuery,
} from "@/hooks/queries/useAnalyticsEventsQueries";
import type { QueryFilter } from "./types";

type FilterOperator = QueryFilter["operator"];

const FIELD_LABELS: Record<string, string> = {
  event_type: "Event Type",
  event_name: "Event Name",
  screen_name: "Screen",
  visitor: "User",
  visitor_id: "User",
  session_id: "Session",
  platform: "Platform",
  app_version: "Version",
  device_model: "Device",
  os: "OS",
  os_version: "OS Version",
  country: "Country",
  city: "City",
  tracking_source: "Source",
  tracking_medium: "Medium",
  tracking_campaign: "UTM Campaign",
  campaign: "Campaign",
  campaign_id: "Campaign",
  link: "Link",
  link_id: "Link",
  ads_platform: "Ads Platform",
  sdk_identifier: "SDK",
};

const FIELD_ICONS: Record<string, LucideIcon> = {
  event_type: Zap,
  event_name: Tag,
  screen_name: Monitor,
  visitor: User,
  visitor_id: User,
  session_id: Hash,
  platform: Layers,
  app_version: GitBranch,
  device_model: Monitor,
  os: Smartphone,
  os_version: Hash,
  country: Globe,
  city: MapPin,
  tracking_source: Globe,
  tracking_medium: Globe,
  tracking_campaign: Globe,
  campaign: Megaphone,
  link: Link,
  ads_platform: Globe,
  sdk_identifier: Hash,
};

/** Fields where the API returns {id, name} objects — query with this name, filter with mapped name */
const ID_VALUE_FIELDS = new Set(["campaign", "link", "visitor"]);

/** field-values API field → filter payload field (only for fields that differ) */
const FILTER_FIELD_MAP: Record<string, string> = {
  campaign: "campaign_id",
  link: "link_id",
  visitor: "visitor_id",
};

/** Dashboard picker: the overview rollups carry no dimension but platform. */
const PLATFORM_ONLY_FIELDS = ["platform"];

/** Fields shown in the picker */
const TOP_LEVEL_FIELDS = [
  "event_type",
  "event_name",
  "screen_name",
  "visitor",
  "session_id",
  "platform",
  "app_version",
  "device_model",
  "os",
  "os_version",
  "country",
  "city",
  "campaign",
  "link",
];

function toLabel(key: string): string {
  return key.replace(/[_.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Strip the `user.` namespace so picker items read e.g. "Plan" under the group. */
function userAttrLabel(name: string): string {
  return toLabel(name.replace(/^user\./, ""));
}

type Phase = "idle" | "field" | "operator" | "value";

interface QueryBarProps {
  projectId: string | undefined;
  queryFilters: QueryFilter[];
  onAddFilter: (
    field: string,
    value: string,
    operator: FilterOperator,
    displayValue?: string
  ) => void;
  onRemoveFilter: (id: string) => void;
  onClearAll: () => void;
  searchTerm?: string;
  onSearchTermChange?: (term: string) => void;
  /** Dashboard mode: offer only `platform is …`, the sole filter its endpoints honour. */
  platformOnly?: boolean;
}

function FilterChip({
  filter,
  onRemove,
}: {
  filter: QueryFilter;
  onRemove: (id: string) => void;
}) {
  const isExclude = filter.operator === "is_not";
  const opSymbol =
    filter.operator === "contains" ? "~" : isExclude ? "\u2260" : ":";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-normal shrink-0",
        isExclude
          ? "bg-destructive/15 text-destructive"
          : "bg-secondary text-secondary-foreground"
      )}
    >
      <span className="text-muted-foreground font-medium">
        {FIELD_LABELS[filter.field] ?? toLabel(filter.field) ?? filter.field}
      </span>
      <span>{opSymbol}</span>
      <span className="font-medium max-w-[150px] truncate">
        {filter.displayValue ??
          (filter.field === "country"
            ? countryName(filter.value)
            : filter.field === "platform"
              ? formatPlatformName(filter.value)
              : filter.value)}
      </span>
      <button
        aria-label={`Remove ${FIELD_LABELS[filter.field] ?? filter.field} filter`}
        className="ml-0.5 rounded-sm hover:bg-background/20 p-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(filter.id);
        }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

export default function QueryBar({
  projectId,
  queryFilters,
  onAddFilter,
  onRemoveFilter,
  onClearAll,
  searchTerm = "",
  onSearchTermChange,
  platformOnly = false,
}: QueryBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [inputValue, setInputValue] = useState("");
  const [selectedField, setSelectedField] = useState("");
  const [selectedOperator, setSelectedOperator] =
    useState<FilterOperator>("is");

  // A disabled query still replays cached data, so platformOnly must drop the lists too.
  const fieldsQuery = useAnalyticsEventFieldsQuery(projectId, !platformOnly);
  const propertyKeys = useMemo(() => {
    if (platformOnly || !fieldsQuery.data?.fields) return [];
    return fieldsQuery.data.fields
      .filter((f) => f.type === "property")
      .map((f) => f.name);
  }, [fieldsQuery.data, platformOnly]);
  // Visitor sdk_attributes, pre-prefixed with `user.` by the backend.
  const userAttributeKeys = useMemo(() => {
    if (platformOnly || !fieldsQuery.data?.fields) return [];
    return fieldsQuery.data.fields
      .filter((f) => f.type === "user_attribute")
      .map((f) => f.name);
  }, [fieldsQuery.data, platformOnly]);

  // Debounced so typing a value doesn't fire one field-values request per keystroke
  const [debouncedInput, setDebouncedInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedInput(inputValue), 250);
    return () => clearTimeout(t);
  }, [inputValue]);

  const fieldValuesParams = useMemo(
    () =>
      phase === "value" && selectedField
        ? { field: selectedField, q: debouncedInput || undefined, limit: 50 }
        : undefined,
    [phase, selectedField, debouncedInput]
  );
  const fieldValuesQuery = useAnalyticsEventFieldValuesQuery(
    projectId,
    fieldValuesParams
  );

  const hasContent = searchTerm !== "" || queryFilters.length > 0;

  const resetBuilder = useCallback(() => {
    setPhase("idle");
    setInputValue("");
    setSelectedField("");
    setSelectedOperator("is");
  }, []);

  const handleFocus = useCallback(() => {
    setOpen(true);
    if (phase === "idle") {
      setPhase("field");
      setInputValue("");
    }
  }, [phase]);

  const handleSelectField = useCallback(
    (field: string) => {
      setSelectedField(field);
      // Only `is` is meaningful on the dashboard, so skip the operator step.
      setPhase(platformOnly ? "value" : "operator");
      setInputValue("");
    },
    [platformOnly]
  );

  const handleSelectOperator = useCallback((op: FilterOperator) => {
    setSelectedOperator(op);
    setPhase("value");
    setInputValue("");
  }, []);

  const handleSelectValue = useCallback(
    (value: string, displayValue?: string) => {
      const filterField = FILTER_FIELD_MAP[selectedField] ?? selectedField;
      onAddFilter(filterField, value, selectedOperator, displayValue);
      // Stay in field phase for chaining
      setPhase("field");
      setInputValue("");
      setSelectedField("");
      setSelectedOperator("is");
      inputRef.current?.focus();
    },
    [selectedField, selectedOperator, onAddFilter]
  );

  const handleSearchFallback = useCallback(
    (term: string) => {
      onSearchTermChange?.(term);
      resetBuilder();
      setOpen(false);
    },
    [onSearchTermChange, resetBuilder]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        e.key === "Enter" &&
        phase === "value" &&
        inputValue.trim() &&
        !platformOnly
      ) {
        e.preventDefault();
        handleSelectValue(inputValue.trim());
        return;
      }

      if (
        e.key === "Enter" &&
        phase === "idle" &&
        inputValue.trim() &&
        !platformOnly
      ) {
        e.preventDefault();
        onSearchTermChange?.(inputValue.trim());
        setInputValue("");
        return;
      }

      if (e.key === "Backspace" && inputValue === "") {
        if (phase === "value") {
          e.preventDefault();
          if (platformOnly) {
            setPhase("field");
            setSelectedField("");
          } else {
            setPhase("operator");
          }
          return;
        }
        if (phase === "operator") {
          e.preventDefault();
          setPhase("field");
          setSelectedField("");
          return;
        }
        if (phase === "field" || phase === "idle") {
          // Remove last chip
          if (queryFilters.length > 0) {
            e.preventDefault();
            onRemoveFilter(queryFilters[queryFilters.length - 1]!.id);
          }
          return;
        }
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (phase !== "idle" && phase !== "field") {
          setPhase("field");
          setInputValue("");
          setSelectedField("");
          setSelectedOperator("is");
        } else {
          resetBuilder();
          setOpen(false);
          inputRef.current?.blur();
        }
      }
    },
    [
      phase,
      inputValue,
      queryFilters,
      onRemoveFilter,
      onSearchTermChange,
      resetBuilder,
      handleSelectValue,
      platformOnly,
    ]
  );

  const handleClearAll = useCallback(() => {
    onClearAll();
    onSearchTermChange?.("");
    resetBuilder();
    inputRef.current?.focus();
  }, [onClearAll, onSearchTermChange, resetBuilder]);

  // Filter suggestions based on input
  const fieldSuggestions = useMemo(() => {
    const term = inputValue.toLowerCase();
    const fields = platformOnly ? PLATFORM_ONLY_FIELDS : TOP_LEVEL_FIELDS;
    const topLevel = fields.filter((f) => {
      const label = FIELD_LABELS[f]!.toLowerCase();
      return label.includes(term) || f.includes(term);
    });
    const props = propertyKeys.filter((k) => {
      const label = toLabel(k).toLowerCase();
      return label.includes(term) || k.includes(term);
    });
    const userAttrs = userAttributeKeys.filter((k) => {
      const label = toLabel(k).toLowerCase();
      return label.includes(term) || k.includes(term);
    });
    return { topLevel, properties: props, userAttributes: userAttrs };
  }, [inputValue, propertyKeys, userAttributeKeys, platformOnly]);

  const isIdField = ID_VALUE_FIELDS.has(selectedField);

  /** Flatten all pages into a single values array */
  const allFieldValues = useMemo(() => {
    if (!fieldValuesQuery.data?.pages) return [];
    return fieldValuesQuery.data.pages.flatMap((p) => p.values);
  }, [fieldValuesQuery.data]);

  /** For ID-based fields, keep {id, name} pairs for display */
  const idValueMap = useMemo(() => {
    if (!isIdField) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const v of allFieldValues) {
      if (typeof v === "object" && v !== null && "id" in v) {
        map.set(
          String((v as { id: number | string }).id),
          (v as { name: string }).name
        );
      }
    }
    return map;
  }, [isIdField, allFieldValues]);

  const valueSuggestions = useMemo(() => {
    if (phase !== "value" || !selectedField) return [];
    if (isIdField) {
      return allFieldValues
        .filter(
          (v): v is { id: number | string; name: string } =>
            typeof v === "object" && v !== null && "id" in v
        )
        .map((v) => String(v.id));
    }
    return allFieldValues.filter((v): v is string => typeof v === "string");
  }, [phase, selectedField, isIdField, allFieldValues]);

  // Breadcrumb showing in-progress filter
  const breadcrumb = useMemo(() => {
    const parts: string[] = [];
    if (selectedField && (phase === "operator" || phase === "value")) {
      parts.push(
        FIELD_LABELS[selectedField] ?? toLabel(selectedField) ?? selectedField
      );
    }
    if (selectedOperator && phase === "value") {
      parts.push(
        selectedOperator === "is"
          ? "="
          : selectedOperator === "contains"
            ? "~"
            : "\u2260"
      );
    }
    return parts;
  }, [selectedField, selectedOperator, phase]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            "flex items-center gap-1.5 flex-wrap min-h-10 px-3 py-1.5 rounded-md border border-input bg-background text-sm ring-offset-background cursor-text flex-1",
            open && "ring-2 ring-ring ring-offset-2"
          )}
          onClick={() => inputRef.current?.focus()}
        >
          <Search className="size-4 text-muted-foreground shrink-0" />

          {/* Filter chips */}
          {queryFilters.map((f) => (
            <FilterChip key={f.id} filter={f} onRemove={onRemoveFilter} />
          ))}

          {/* Search term chip */}
          {!platformOnly && searchTerm && (
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary text-secondary-foreground px-2 py-0.5 text-xs font-normal shrink-0">
              <Search className="size-3 text-muted-foreground" />
              <span className="font-medium max-w-[150px] truncate">
                {searchTerm}
              </span>
              <button
                aria-label="Clear search term"
                className="ml-0.5 rounded-sm hover:bg-background/20 p-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(e) => {
                  e.stopPropagation();
                  onSearchTermChange?.("");
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {/* Phase breadcrumb */}
          {breadcrumb.map((part, i) => (
            <span
              key={i}
              className="text-xs font-medium text-muted-foreground shrink-0"
            >
              {part}
            </span>
          ))}

          {/* Input */}
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={
              queryFilters.length > 0 || searchTerm
                ? ""
                : platformOnly
                  ? "Filter by platform..."
                  : "Filter events..."
            }
            className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground text-sm"
          />

          {/* Clear all button */}
          {hasContent && (
            <button
              aria-label="Clear all filters"
              className="shrink-0 p-1 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </PopoverAnchor>

      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)]"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            {/* Field phase */}
            {phase === "field" && (
              <>
                {fieldSuggestions.topLevel.length > 0 && (
                  <CommandGroup heading="Attributes">
                    {fieldSuggestions.topLevel.map((field) => {
                      const Icon = FIELD_ICONS[field] ?? Hash;
                      return (
                        <CommandItem
                          key={field}
                          onSelect={() => handleSelectField(field)}
                        >
                          <Icon className="size-4 text-muted-foreground" />
                          {FIELD_LABELS[field]}
                          <span className="ml-auto text-xs text-muted-foreground">
                            {field}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
                {fieldSuggestions.properties.length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading="Event properties">
                      {fieldSuggestions.properties.map((key) => (
                        <CommandItem
                          key={key}
                          onSelect={() => handleSelectField(key)}
                        >
                          <Braces className="size-4 text-muted-foreground" />
                          {toLabel(key)}
                          <span className="ml-auto text-xs text-muted-foreground">
                            {key}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
                {fieldSuggestions.userAttributes.length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading="User attributes">
                      {fieldSuggestions.userAttributes.map((key) => (
                        <CommandItem
                          key={key}
                          onSelect={() => handleSelectField(key)}
                        >
                          <User className="size-4 text-muted-foreground" />
                          {userAttrLabel(key)}
                          <span className="ml-auto text-xs text-muted-foreground">
                            {key}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
                {fieldSuggestions.topLevel.length === 0 &&
                  fieldSuggestions.properties.length === 0 &&
                  fieldSuggestions.userAttributes.length === 0 &&
                  inputValue && (
                    <CommandEmpty>No matching attributes</CommandEmpty>
                  )}
                {inputValue && !platformOnly && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => handleSearchFallback(inputValue)}
                      >
                        <Search className="size-4 text-muted-foreground" />
                        Search for &quot;{inputValue}&quot;
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}

            {/* Operator phase */}
            {phase === "operator" && (
              <CommandGroup
                heading={`${FIELD_LABELS[selectedField] ?? toLabel(selectedField) ?? selectedField} ...`}
              >
                <CommandItem onSelect={() => handleSelectOperator("is")}>
                  <Equal className="size-4 text-muted-foreground" />
                  is
                  <span className="ml-auto text-xs text-muted-foreground">
                    include
                  </span>
                </CommandItem>
                <CommandItem onSelect={() => handleSelectOperator("is_not")}>
                  <EqualNot className="size-4 text-muted-foreground" />
                  is not
                  <span className="ml-auto text-xs text-muted-foreground">
                    exclude
                  </span>
                </CommandItem>
                {!ID_VALUE_FIELDS.has(selectedField) &&
                  selectedField !== "platform" && (
                    <CommandItem
                      onSelect={() => handleSelectOperator("contains")}
                    >
                      <TextSearch className="size-4 text-muted-foreground" />
                      contains
                      <span className="ml-auto text-xs text-muted-foreground">
                        substring match
                      </span>
                    </CommandItem>
                  )}
              </CommandGroup>
            )}

            {/* Value phase */}
            {phase === "value" && (
              <>
                <CommandGroup
                  heading={`${FIELD_LABELS[selectedField] ?? toLabel(selectedField) ?? selectedField} ${selectedOperator === "is" ? "=" : selectedOperator === "contains" ? "~" : "\u2260"} ...`}
                >
                  {valueSuggestions.map((val) => {
                    const display = isIdField
                      ? (idValueMap.get(val) ?? val)
                      : selectedField === "country"
                        ? countryName(val)
                        : selectedField === "platform"
                          ? formatPlatformName(val)
                          : val;
                    return (
                      <CommandItem
                        key={val}
                        onSelect={() =>
                          handleSelectValue(
                            val,
                            isIdField
                              ? (idValueMap.get(val) ?? undefined)
                              : undefined
                          )
                        }
                      >
                        {display}
                      </CommandItem>
                    );
                  })}
                  {fieldValuesQuery.hasNextPage && (
                    <CommandItem
                      onSelect={() => fieldValuesQuery.fetchNextPage()}
                      className="justify-center text-muted-foreground"
                    >
                      {fieldValuesQuery.isFetchingNextPage
                        ? "Loading..."
                        : "Load more"}
                    </CommandItem>
                  )}
                </CommandGroup>
                {valueSuggestions.length === 0 && !inputValue && (
                  <CommandEmpty>
                    {fieldValuesQuery.isLoading
                      ? "Loading..."
                      : platformOnly
                        ? "No platforms recorded yet"
                        : "Type a value or wait for suggestions"}
                  </CommandEmpty>
                )}
                {inputValue && !platformOnly && (
                  <CommandItem onSelect={() => handleSelectValue(inputValue)}>
                    Use &quot;{inputValue}&quot;
                  </CommandItem>
                )}
                {selectedField.startsWith("user.") && (
                  <div className="border-t border-border px-3 py-2 text-[11px] leading-snug text-muted-foreground">
                    Matches the attribute value at the time of the event — user
                    attributes aren&apos;t stored on historically imported
                    events.
                  </div>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
