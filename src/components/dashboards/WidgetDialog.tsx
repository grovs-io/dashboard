"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronsUpDown,
  Hash,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  Table2,
  X,
  type LucideIcon,
} from "lucide-react";
import ActionConfirm from "@/components/common/action-confirm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import QueryBar from "@/components/analytics/events/QueryBar";
import type { QueryFilter } from "@/components/analytics/events/types";
import { WidgetFrame } from "@/components/analytics/widgets/WidgetFrame";
import { WidgetRenderer } from "@/components/analytics/widgets/WidgetRenderer";
import {
  useAnalyticsEventFieldValuesQuery,
  useAnalyticsEventFieldsQuery,
} from "@/hooks/queries/useAnalyticsEventsQueries";
import {
  DIMENSIONS,
  TOP_OPTIONS,
  metricQueryBlockReason,
} from "@/lib/metricQuery";
import {
  EVENT_OPTIONS,
  LINK_MEASURE_HINT,
  MEASURES,
  describeWidget,
  eventKey,
  eventLabel,
  fromMetric,
  measureAllowed,
  sameEvent,
  type EventChoice,
} from "@/lib/widgetQueryModel";
import { cn } from "@/lib/utils";
import {
  DEFAULT_WIDGET_FORM,
  presetToFormValues,
  widgetFilterChips,
  widgetFormSchema,
  widgetFormToPayload,
  widgetToFormValues,
  type WidgetFormValues,
  type WidgetInitial,
} from "@/schemas/dashboard";
import {
  mergeFilterList,
  withMergedFilters,
  type WidgetRangeLimits,
} from "./widgetLayout";
import { PanelWidget } from "./PanelWidget";
import { PANEL_CATALOG, PANEL_DATE_ONLY_NOTE, panelMeta } from "./panelCatalog";
import { WIDGET_TEMPLATES, type WidgetTemplate } from "./widgetTemplates";
import type {
  AnalyticsDateRangeParams,
  AnalyticsGranularity,
  Dashboard,
  DashboardWidget,
  StoredFilter,
  WidgetPayload,
} from "@/types";

const VIZ_OPTIONS: {
  key: WidgetFormValues["viz"];
  label: string;
  icon: LucideIcon;
}[] = [
  { key: "bar", label: "Bar list", icon: BarChart3 },
  { key: "number", label: "Number", icon: Hash },
  { key: "line", label: "Timeline", icon: LineChart },
  { key: "table", label: "Table", icon: Table2 },
];
const SIZE_OPTIONS: { key: WidgetFormValues["size"]; label: string }[] = [
  { key: "sm", label: "Small" },
  { key: "md", label: "Medium" },
  { key: "lg", label: "Full width" },
];

export type WidgetDialogSubmit = {
  dashboardId?: number;
  payload: WidgetPayload;
};

const filterKey = (f: StoredFilter) => `${f.field}_${f.operator}_${f.value}`;
/** Seeded ids carry the index so a stored list with repeats still keys uniquely. */
const toQueryFilters = (list: StoredFilter[]): QueryFilter[] =>
  list.map((f, i) => ({
    id: `stored_${i}_${filterKey(f)}`,
    field: f.field,
    operator: f.operator,
    value: f.value,
  }));
/** Stored jsonb reorders keys; compare canonical shapes. */
const canonical = (list: StoredFilter[]) =>
  JSON.stringify(mergeFilterList([], list));
/** JSON with object keys sorted, so reordered jsonb compares equal. */
const stableJson = (value: unknown) =>
  JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))
        )
      : v
  );

function dimensionLabel(groupBy: string): string {
  return (
    DIMENSIONS.find((d) => d.key === groupBy)?.label ??
    groupBy.replace(/^properties\./, "")
  );
}

/** Form values + Filter chips; a prefilled metric seeds Event × Measure and may claim a chip. */
function seed(
  widget: DashboardWidget | undefined,
  initial: WidgetInitial | undefined,
  filters: StoredFilter[]
): { values: WidgetFormValues; chips: StoredFilter[] } {
  if (widget)
    return {
      values: widgetToFormValues(widget),
      chips: widgetFilterChips(widget),
    };
  const { metric, ...rest } = initial ?? {};
  const shown = metric
    ? fromMetric(metric, filters)
    : {
        event: DEFAULT_WIDGET_FORM.event,
        measure: DEFAULT_WIDGET_FORM.measure,
        rest: filters,
      };
  return {
    values: {
      ...DEFAULT_WIDGET_FORM,
      ...rest,
      event: shown.event,
      measure: shown.measure,
    },
    chips: shown.rest,
  };
}

const CAPTION =
  "text-[11px] font-medium uppercase tracking-wide text-muted-foreground";
const SUB_LABEL = "text-xs font-normal text-muted-foreground";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <h3 className={CAPTION}>{title}</h3>
        {description && (
          <p className="text-[12px] text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

const FILTER_DESCRIPTION = "Applied on top of the dashboard's filters.";

function LibraryRow({
  icon: Icon,
  label,
  description,
  pressed,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        pressed
          ? "border-[var(--chart-users)] bg-[var(--chart-users)]/[0.06]"
          : "border-sidebar-border hover:bg-muted"
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          pressed
            ? "bg-[var(--chart-users)]/10 text-[var(--chart-users)]"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium">{label}</span>
        <span className="truncate text-[12px] text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}

/** Built-in events first, then the project's custom event names (searched server-side). */
function EventPicker({
  projectId,
  value,
  onChange,
}: {
  projectId: string | undefined;
  value: EventChoice;
  onChange: (e: EventChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Debounced like QueryBar so typing doesn't fire one request per keystroke.
  const q = useDebouncedValue(search.trim(), 250);
  const names = useAnalyticsEventFieldValuesQuery(
    projectId,
    open ? { field: "event_name", ...(q ? { q } : {}), limit: 50 } : undefined,
    { keepPrevious: true }
  );
  const customNames = useMemo(
    () =>
      (names.data?.pages ?? [])
        .flatMap((p) => p.values)
        .filter((v): v is string => typeof v === "string" && v !== ""),
    [names.data]
  );
  const builtIns = EVENT_OPTIONS.filter(
    (o) => !q || o.label.toLowerCase().includes(q.toLowerCase())
  );
  const pick = (e: EventChoice) => {
    onChange(e);
    setOpen(false);
    setSearch("");
  };
  const tick = (e: EventChoice) => (
    <Check
      className={cn(
        "ml-auto size-4",
        sameEvent(e, value) ? "opacity-100" : "opacity-0"
      )}
    />
  );

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label="Event"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{eventLabel(value)}</span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search events…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {builtIns.length > 0 && (
              <CommandGroup heading="Built-in">
                {builtIns.map((o) => (
                  <CommandItem
                    key={eventKey(o.event)}
                    value={eventKey(o.event)}
                    onSelect={() => pick(o.event)}
                  >
                    {o.label}
                    {tick(o.event)}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="Custom events">
              {names.isLoading ? (
                <CommandItem disabled value="__loading">
                  Loading events…
                </CommandItem>
              ) : customNames.length === 0 ? (
                // CommandEmpty never shows with shouldFilter={false} while built-ins match.
                <CommandItem
                  disabled
                  value="__none"
                  className="text-muted-foreground"
                >
                  No custom events found.
                </CommandItem>
              ) : (
                customNames.map((name) => (
                  <CommandItem
                    key={`name:${name}`}
                    value={`name:${name}`}
                    onSelect={() => pick({ kind: "name", value: name })}
                  >
                    <span className="truncate">{name}</span>
                    {tick({ kind: "name", value: name })}
                  </CommandItem>
                ))
              )}
              {names.hasNextPage && (
                <CommandItem
                  value="__more"
                  onSelect={() => void names.fetchNextPage()}
                  className="text-muted-foreground"
                >
                  {names.isFetchingNextPage ? "Loading…" : "Load more"}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function WidgetDialog({
  open,
  onOpenChange,
  projectId,
  dashboards,
  base,
  granularity,
  initial,
  widget,
  filters,
  defaultDashboardId,
  limits,
  revenueEnabled = false,
  pending = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | undefined;
  dashboards: Dashboard[];
  base: AnalyticsDateRangeParams;
  granularity: AnalyticsGranularity;
  initial?: WidgetInitial;
  widget?: DashboardWidget;
  filters: StoredFilter[];
  defaultDashboardId?: number;
  /** The page's range facts; the preview is gated on its own query and merged filters. */
  limits: WidgetRangeLimits;
  /** The instance collects revenue; gates the Revenue panel preview. */
  revenueEnabled?: boolean;
  pending?: boolean;
  onSubmit: (result: WidgetDialogSubmit) => Promise<void> | void;
}) {
  const editing = !!widget;
  // The page remounts the dialog per session (key), so seeding happens once, here.
  const [seeded] = useState(() => seed(widget, initial, filters));
  const form = useForm<WidgetFormValues>({
    resolver: zodResolver(widgetFormSchema),
    defaultValues: seeded.values,
    mode: "onChange",
  });
  const [queryFilters, setQueryFilters] = useState<QueryFilter[]>(() =>
    toQueryFilters(seeded.chips)
  );
  const storedFilters = useMemo<StoredFilter[]>(
    () =>
      queryFilters.map(({ field, operator, value }) => ({
        field,
        operator,
        value,
      })),
    [queryFilters]
  );
  const [target, setTarget] = useState<string>(() =>
    String(defaultDashboardId ?? dashboards[0]?.id ?? "")
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fieldsRequested, setFieldsRequested] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // The last title filled in from a panel's label, so picking another panel may replace it.
  const autoTitle = useRef<string | null>(null);

  // Event properties load the first time the Group by picker opens, then stay.
  const fieldsQuery = useAnalyticsEventFieldsQuery(projectId, fieldsRequested);
  const propertyDimensions = useMemo(
    () =>
      (fieldsQuery.data?.fields ?? [])
        .filter((f) => f.type === "property")
        .map((f) => ({ key: `properties.${f.name}`, label: f.name })),
    [fieldsQuery.data]
  );

  // Full values: every field has a default from seed().
  const values = useWatch({ control: form.control }) as WidgetFormValues;
  const { errors, isDirty } = form.formState;
  const isPanel = values.kind === "panel";
  const panel = isPanel && values.panel ? panelMeta(values.panel) : undefined;
  const showFilters = !isPanel || !panel || panel.filtersHonoured;

  const pageFilters = useMemo<StoredFilter[]>(
    () => (base.filters ? (JSON.parse(base.filters) as StoredFilter[]) : []),
    [base.filters]
  );
  const preview = useMemo(
    () =>
      widgetFormToPayload(
        { ...values, kind: "metric" },
        storedFilters,
        granularity
      ),
    [values, storedFilters, granularity]
  );
  const metricQuery =
    preview.kind === "metric" ? preview.query : { metric: "events" as const };
  const merged = useMemo(
    () => mergeFilterList(pageFilters, preview.filters),
    [pageFilters, preview.filters]
  );
  const previewBase = useMemo(
    () => withMergedFilters(base, merged),
    [base, merged]
  );
  const blocked = isPanel
    ? undefined
    : metricQueryBlockReason(metricQuery, merged, limits);
  const canPreview = !!projectId && !!base.start_date;

  const dirty = isDirty || canonical(storedFilters) !== canonical(seeded.chips);
  const requestClose = () =>
    dirty ? setConfirmDiscard(true) : onOpenChange(false);

  const submit = form.handleSubmit(async (v) => {
    const honoured =
      v.kind !== "panel" || !v.panel || panelMeta(v.panel).filtersHonoured;
    const payload = widgetFormToPayload(
      v,
      honoured ? storedFilters : [],
      granularity
    );
    if (editing) {
      // A copied hint ("Top 5") describes the old data, so drop it once that changes.
      const dataChanged =
        payload.kind !== widget!.kind ||
        payload.panel !== widget!.panel ||
        stableJson(payload.query) !== stableJson(widget!.query);
      return onSubmit({
        dashboardId: widget!.dashboard_id,
        payload: dataChanged ? { ...payload, subtitle: null } : payload,
      });
    }
    return onSubmit({
      dashboardId: target ? Number(target) : undefined,
      payload,
    });
  });

  const viz = values.viz;
  const grouped = viz !== "number" && !!values.group_by;
  const dimensionKnown =
    DIMENSIONS.some((d) => d.key === values.group_by) ||
    propertyDimensions.some((d) => d.key === values.group_by);
  const groupByLabel =
    viz === "number" || !values.group_by
      ? "None (total)"
      : dimensionLabel(values.group_by);
  const linkEvent = !measureAllowed(values.event, "unique_visitors");
  const firstError =
    errors.title?.message ??
    errors.panel?.message ??
    errors.measure?.message ??
    errors.limit?.message ??
    errors.group_by?.message;

  const set = <K extends keyof WidgetFormValues>(
    key: K,
    value: WidgetFormValues[K]
  ) =>
    form.setValue(key, value as never, {
      shouldDirty: true,
      shouldValidate: key === "title" || key === "panel",
    });
  const setViz = (next: WidgetFormValues["viz"]) => {
    set("viz", next);
    if (next === "number") set("group_by", "");
    if (next === "line") set("compare", false);
  };
  const setEvent = (next: EventChoice) => {
    set("event", next);
    if (!measureAllowed(next, values.measure)) set("measure", "count");
  };
  const pickPanel = (key: NonNullable<WidgetFormValues["panel"]>) => {
    set("panel", key);
    const title = form.getValues("title").trim();
    if (!title || title === autoTitle.current) {
      autoTitle.current = panelMeta(key).label;
      set("title", autoTitle.current);
    }
  };
  // A preset lands in the Metric builder, prefilled and ready to tweak; its filters replace the chips.
  const pickPreset = (template: WidgetTemplate) => {
    const { values: next, chips } = presetToFormValues(template);
    (Object.keys(next) as (keyof WidgetFormValues)[]).forEach((k) =>
      set(k, next[k])
    );
    set("panel", undefined);
    setQueryFilters(toQueryFilters(chips));
    autoTitle.current = null;
  };
  // Same id and de-dupe rule as the page's addFilter (useTableParams).
  const addFilter = (
    field: string,
    value: string,
    operator: QueryFilter["operator"],
    displayValue?: string
  ) => {
    const next: StoredFilter = { field, operator, value };
    const same = (f: QueryFilter) =>
      f.field === next.field &&
      f.operator === next.operator &&
      f.value === next.value;
    setQueryFilters((prev) =>
      prev.some(same)
        ? prev
        : [
            ...prev,
            {
              id: filterKey(next),
              ...next,
              ...(displayValue ? { displayValue } : {}),
            },
          ]
    );
  };
  const pickGroupBy = (key: string) => {
    set("group_by", key);
    setPickerOpen(false);
  };

  const filterBar = (
    // Enter must drive the builder, never submit the dialog's form.
    <div
      className="flex"
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
    >
      <QueryBar
        projectId={projectId}
        queryFilters={queryFilters}
        onAddFilter={addFilter}
        onRemoveFilter={(id) =>
          setQueryFilters((prev) => prev.filter((f) => f.id !== id))
        }
        onClearAll={() => setQueryFilters([])}
      />
    </div>
  );

  let previewBody: ReactNode;
  if (!canPreview)
    previewBody = (
      <p className="text-xs text-muted-foreground">
        Pick a date range to preview.
      </p>
    );
  else if (isPanel && values.panel) {
    previewBody = (
      <PanelWidget
        projectId={projectId}
        panel={values.panel}
        base={base}
        pageFilters={pageFilters}
        filters={showFilters ? storedFilters : []}
        limits={limits}
        revenueEnabled={revenueEnabled}
        granularity={granularity}
      />
    );
  } else if (isPanel)
    previewBody = (
      <p className="text-xs text-muted-foreground">
        Pick a panel to preview it.
      </p>
    );
  else {
    previewBody = (
      <WidgetRenderer
        projectId={projectId}
        base={previewBase}
        query={metricQuery}
        viz={viz}
        enabled={!blocked}
        emptyText={blocked ?? "No data for this selection"}
      />
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
    >
      <DialogContent
        aria-describedby="widget-dialog-description"
        showCloseButton={false}
        className="flex h-[90vh] max-h-[820px] w-full flex-col gap-0 overflow-hidden border-sidebar-border p-0 sm:max-w-[90vw] xl:max-w-[1120px]"
      >
        <DialogDescription id="widget-dialog-description" className="sr-only">
          Choose what the widget shows and how it looks. It follows the
          dashboard&apos;s date range and filters.
        </DialogDescription>
        <DialogHeader>
          <div className="flex w-full items-center gap-3 px-5 py-3.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-primary">
              <LayoutDashboard className="h-4 w-4" />
            </span>
            <DialogTitle className="text-[15px] font-semibold">
              {editing ? "Edit widget" : "Add widget"}
            </DialogTitle>
            <button
              type="button"
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              onClick={requestClose}
              disabled={pending}
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>
        <Separator />
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-full min-h-0 flex-1 overflow-hidden">
            <div className="flex w-[380px] shrink-0 flex-col gap-6 overflow-auto border-r border-sidebar-border px-5 pt-5 pb-8">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="widget-title">Title</Label>
                <Input
                  id="widget-title"
                  autoFocus={!editing}
                  placeholder="e.g. Installs by country"
                  aria-invalid={!!errors.title}
                  {...form.register("title")}
                />
                {errors.title && (
                  <p className="text-xs text-destructive">
                    {errors.title.message}
                  </p>
                )}
              </div>

              {!editing && (
                <Tabs
                  value={values.kind}
                  onValueChange={(k) =>
                    set("kind", k as WidgetFormValues["kind"])
                  }
                >
                  <TabsList aria-label="Widget kind" className="w-full">
                    <TabsTrigger value="metric" className="flex-1">
                      Metric
                    </TabsTrigger>
                    <TabsTrigger value="panel" className="flex-1">
                      Library
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

              {!isPanel ? (
                <>
                  <Section title="Show">
                    <div className="flex flex-col gap-1.5">
                      <Label className={SUB_LABEL}>Event</Label>
                      <EventPicker
                        projectId={projectId}
                        value={values.event}
                        onChange={setEvent}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className={SUB_LABEL}>Measure</Label>
                      <Select
                        value={values.measure}
                        onValueChange={(m) =>
                          set("measure", m as WidgetFormValues["measure"])
                        }
                      >
                        <SelectTrigger aria-label="Measure" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MEASURES.map((m) => (
                            <SelectItem
                              key={m.key}
                              value={m.key}
                              disabled={!measureAllowed(values.event, m.key)}
                            >
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {linkEvent && (
                        <p className="text-[12px] text-muted-foreground">
                          {LINK_MEASURE_HINT}
                        </p>
                      )}
                    </div>
                  </Section>

                  <Section title="Filter" description={FILTER_DESCRIPTION}>
                    {filterBar}
                    {queryFilters.length === 0 && (
                      <p className="text-[12px] text-muted-foreground">
                        No filters. The widget shows whatever the
                        dashboard&apos;s filters allow.
                      </p>
                    )}
                  </Section>

                  <Section title="Break down by">
                    <Popover
                      modal
                      open={pickerOpen}
                      onOpenChange={(o) => {
                        setPickerOpen(o);
                        if (o) setFieldsRequested(true);
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-label="Group by"
                          aria-expanded={pickerOpen}
                          disabled={viz === "number"}
                          className="w-full justify-between font-normal"
                        >
                          <span className="truncate">{groupByLabel}</span>
                          <ChevronsUpDown className="size-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[300px] p-0">
                        <Command>
                          <CommandInput placeholder="Search dimensions…" />
                          <CommandList>
                            <CommandEmpty>No matching dimension.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="none"
                                keywords={["None (total)"]}
                                onSelect={() => pickGroupBy("")}
                              >
                                None (total)
                                <Check
                                  className={cn(
                                    "ml-auto size-4",
                                    values.group_by
                                      ? "opacity-0"
                                      : "opacity-100"
                                  )}
                                />
                              </CommandItem>
                            </CommandGroup>
                            <CommandGroup heading="Attributes">
                              {DIMENSIONS.map((d) => (
                                <CommandItem
                                  key={d.key}
                                  value={d.key}
                                  keywords={[d.label]}
                                  onSelect={() => pickGroupBy(d.key)}
                                >
                                  {d.label}
                                  <Check
                                    className={cn(
                                      "ml-auto size-4",
                                      values.group_by === d.key
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            {(propertyDimensions.length > 0 ||
                              (!dimensionKnown && values.group_by)) && (
                              <CommandGroup heading="Event properties">
                                {propertyDimensions.map((d) => (
                                  <CommandItem
                                    key={d.key}
                                    value={d.key}
                                    keywords={[d.label]}
                                    onSelect={() => pickGroupBy(d.key)}
                                  >
                                    {d.label}
                                    <Check
                                      className={cn(
                                        "ml-auto size-4",
                                        values.group_by === d.key
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                  </CommandItem>
                                ))}
                                {!dimensionKnown && values.group_by && (
                                  <CommandItem
                                    value={values.group_by}
                                    onSelect={() =>
                                      pickGroupBy(values.group_by)
                                    }
                                  >
                                    {dimensionLabel(values.group_by)}
                                    <Check className="ml-auto size-4" />
                                  </CommandItem>
                                )}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {viz === "number" && (
                      <p className="text-[12px] text-muted-foreground">
                        A Number shows the total, so it isn&apos;t broken down.
                      </p>
                    )}
                    {grouped && (
                      <Select
                        value={String(
                          TOP_OPTIONS.includes(values.limit) ? values.limit : 10
                        )}
                        onValueChange={(v) => set("limit", Number(v))}
                      >
                        <SelectTrigger
                          aria-label="Top"
                          size="sm"
                          className="w-[110px]"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TOP_OPTIONS.map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              Top {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {errors.limit && (
                      <p className="text-xs text-destructive">
                        {errors.limit.message}
                      </p>
                    )}
                  </Section>
                </>
              ) : (
                <>
                  <Section title="Ready-made panels">
                    <div className="flex flex-col gap-1.5">
                      {PANEL_CATALOG.map((p) => (
                        <LibraryRow
                          key={p.key}
                          icon={p.icon}
                          label={p.label}
                          description={p.description}
                          pressed={values.panel === p.key}
                          onClick={() => pickPanel(p.key)}
                        />
                      ))}
                    </div>
                  </Section>
                  {panel && !panel.filtersHonoured ? (
                    <Section title="Filter">
                      <p className="text-[12px] text-muted-foreground">
                        {PANEL_DATE_ONLY_NOTE}
                      </p>
                    </Section>
                  ) : (
                    <Section title="Filter" description={FILTER_DESCRIPTION}>
                      {filterBar}
                    </Section>
                  )}
                  <Section title="Or start from a preset">
                    <div className="flex flex-col gap-1.5">
                      {WIDGET_TEMPLATES.map((t) => (
                        <LibraryRow
                          key={t.key}
                          icon={t.icon}
                          label={t.title}
                          description={t.description}
                          onClick={() => pickPreset(t)}
                        />
                      ))}
                    </div>
                  </Section>
                </>
              )}
            </div>

            <section
              aria-label="Preview"
              className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto bg-sidebar p-5 text-sidebar-foreground"
            >
              <h3 className={CAPTION}>Display</h3>
              <div className="-mt-2 flex flex-wrap items-center gap-x-5 gap-y-3">
                {!isPanel && (
                  <div
                    role="group"
                    aria-label="Chart type"
                    className="inline-flex rounded-lg border border-sidebar-border bg-background p-0.5"
                  >
                    {VIZ_OPTIONS.map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={viz === key}
                        title={label}
                        onClick={() => setViz(key)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          viz === key
                            ? "bg-[var(--chart-users)]/10 text-[var(--chart-users)]"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon className="size-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                <Select
                  value={values.size}
                  onValueChange={(v) =>
                    set("size", v as WidgetFormValues["size"])
                  }
                >
                  <SelectTrigger
                    aria-label="Size"
                    size="sm"
                    className="w-[130px]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZE_OPTIONS.map((o) => (
                      <SelectItem key={o.key} value={o.key}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isPanel && (
                  <Select
                    value={values.compare ? "previous" : "none"}
                    onValueChange={(v) => set("compare", v === "previous")}
                    disabled={viz === "line"}
                  >
                    <SelectTrigger
                      aria-label="Compare"
                      size="sm"
                      className="w-[180px]"
                      title={
                        viz === "line"
                          ? "Timelines already show change over time."
                          : undefined
                      }
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No previous period</SelectItem>
                      <SelectItem value="previous">Previous period</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <WidgetFrame
                title={values.title || "Untitled widget"}
                subtitle={
                  isPanel
                    ? panel?.label
                    : describeWidget({
                        query: metricQuery,
                        filters: preview.filters,
                      })
                }
                className="rounded-lg border-0 bg-background shadow-sm ring-1 ring-sidebar-border"
              >
                {previewBody}
              </WidgetFrame>
              <p className="px-1 text-[13px] text-muted-foreground">
                {panel && !panel.filtersHonoured
                  ? "Follows the dashboard's date range and platform."
                  : "Follows the dashboard's date range and filters."}
              </p>
            </section>
          </div>
          <Separator />
          <div className="flex shrink-0 flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 text-sm">
              {firstError ? (
                <p role="alert" className="text-destructive">
                  {firstError}
                </p>
              ) : blocked ? (
                <p
                  role="status"
                  className="flex items-center gap-1.5 text-muted-foreground"
                >
                  <AlertTriangle className="size-4 shrink-0" />
                  {blocked}
                </p>
              ) : null}
            </div>
            {!editing && (
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger
                  aria-label="Dashboard"
                  size="sm"
                  className="w-[200px] shrink-0"
                >
                  <LayoutGrid className="size-4 text-muted-foreground" />
                  <SelectValue placeholder="Choose a dashboard" />
                </SelectTrigger>
                <SelectContent>
                  {dashboards.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              type="submit"
              className="shrink-0"
              disabled={pending || (!editing && !target)}
              aria-busy={pending}
            >
              {pending ? "Saving…" : editing ? "Save widget" : "Add widget"}
            </Button>
          </div>
        </form>
        <ActionConfirm
          open={confirmDiscard}
          setOpen={setConfirmDiscard}
          onConfirm={() => onOpenChange(false)}
          title="Discard unsaved changes?"
          description="You have unsaved changes that will be lost if you close this dialog."
          confirmText="Discard"
          cancelText="Continue editing"
        />
      </DialogContent>
    </Dialog>
  );
}
