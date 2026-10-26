import {
  Activity,
  ChartPie,
  CircleDollarSign,
  Link2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { KPI_ROWS, type KpiPanelKey } from "./KpiRowPanel";
import type { SetupKind } from "@/lib/sdkStatus";
import type {
  DashboardWidget,
  MetricQuery,
  PanelKey,
  WidgetPayload,
  WidgetSize,
  WidgetViz,
} from "@/types";

/** "" is Overview, matching the empty `board` URL param. */
export type BuiltinKey =
  | ""
  | "acquisition"
  | "engagement"
  | "revenue"
  | "links";

/** Display-only extras on the built-in board; a copy keeps just the widget. */
export type BuiltinWidget = DashboardWidget & {
  /** Two widgets side by side; the copy keeps `size`. */
  half?: boolean;
  /** "View all" link in the card header. */
  viewAll?: string;
};

type Extras = Pick<BuiltinWidget, "half" | "subtitle" | "viewAll">;

/** Which "no data yet" panel the dashboard shows. */
export interface BuiltinDashboard {
  key: BuiltinKey;
  name: string;
  description: string;
  icon: LucideIcon;
  setup: SetupKind;
  widgets: BuiltinWidget[];
}

let nextId = -1;
const common = (title: string, size: WidgetSize) => ({
  id: nextId--,
  dashboard_id: 0,
  position: 0,
  created_at: "",
  updated_at: "",
  title,
  size,
  filters: [],
});

const panel = (
  key: PanelKey,
  title: string,
  size: WidgetSize,
  extras: Extras = {}
): BuiltinWidget => ({
  ...common(title, size),
  kind: "panel",
  panel: key,
  viz: "number",
  query: {},
  ...extras,
});

const metric = (
  title: string,
  viz: WidgetViz,
  size: WidgetSize,
  query: MetricQuery,
  extras: Extras = {}
): BuiltinWidget => ({
  ...common(title, size),
  kind: "metric",
  panel: null,
  viz,
  query,
  ...extras,
});

const withPositions = (widgets: BuiltinWidget[]) =>
  widgets.map((w, i) => ({ ...w, position: i }));

const top5 = (metric: MetricQuery["metric"], group_by: string) => ({
  metric,
  group_by,
  limit: 5,
});

export const BUILTIN_DASHBOARDS: BuiltinDashboard[] = [
  {
    key: "",
    name: "Overview",
    description: "Everything at a glance",
    icon: ChartPie,
    setup: "events",
    widgets: [],
  },
  {
    key: "acquisition",
    name: "Acquisition",
    description: "Where new users come from",
    icon: UserPlus,
    setup: "events",
    widgets: withPositions([
      panel("kpis_acquisition", "Key numbers", "lg", {
        subtitle: "vs previous period",
      }),
      panel("user_trends", "New users", "md", {
        subtitle: "{period}, vs previous period",
      }),
      panel("acquisition_channels", "Acquisition channels", "sm", {
        subtitle: "Share of new users",
      }),
      metric("By platform", "bar", "lg", top5("installs", "platform"), {
        subtitle: "Installs per platform",
      }),
      metric("Installs by country", "bar", "sm", top5("installs", "country"), {
        subtitle: "Top 5",
      }),
      metric(
        "Top campaigns",
        "bar",
        "sm",
        top5("link_driven_installs", "campaign_id"),
        { subtitle: "By installs", viewAll: "/dynamic_links/campaigns" }
      ),
      metric("Top sources", "bar", "sm", top5("installs", "tracking_source"), {
        subtitle: "utm_source",
      }),
    ]),
  },
  {
    key: "engagement",
    name: "Engagement",
    description: "Who comes back and what they do",
    icon: Activity,
    setup: "events",
    widgets: withPositions([
      panel("kpis_engagement", "Key numbers", "lg", {
        subtitle: "vs previous period",
      }),
      metric(
        "App opens",
        "line",
        "md",
        { metric: "app_opens" },
        { subtitle: "{period}" }
      ),
      panel("retention", "Retention", "sm", {
        subtitle: "Users active on day N",
      }),
      metric("Top events", "bar", "md", top5("events", "event_name"), {
        half: true,
        subtitle: "By count",
      }),
      metric(
        "Opens by app version",
        "bar",
        "sm",
        top5("app_opens", "app_version"),
        { half: true, subtitle: "Top 5" }
      ),
    ]),
  },
  {
    key: "revenue",
    name: "Revenue",
    description: "What users spend",
    icon: CircleDollarSign,
    setup: "purchases",
    widgets: withPositions([
      panel("kpis_revenue", "Key numbers", "lg", {
        subtitle: "vs previous period",
      }),
      panel("revenue_trend", "Revenue", "lg", {
        subtitle: "{period}, vs previous period",
      }),
    ]),
  },
  {
    key: "links",
    name: "Links",
    description: "How your links perform",
    icon: Link2,
    setup: "links",
    widgets: withPositions([
      panel("kpis_links", "Key numbers", "lg", {
        subtitle: "vs previous period",
      }),
      metric(
        "Link views",
        "line",
        "md",
        { metric: "link_views" },
        { subtitle: "{period}" }
      ),
      metric("Views by country", "bar", "sm", top5("link_views", "country"), {
        subtitle: "Top 5",
      }),
      metric("Top links", "bar", "md", top5("link_views", "link_id"), {
        half: true,
        subtitle: "By views",
        viewAll: "/dynamic_links/links",
      }),
      metric("Top campaigns", "bar", "sm", top5("link_views", "campaign_id"), {
        half: true,
        subtitle: "By views",
        viewAll: "/dynamic_links/campaigns",
      }),
    ]),
  },
];

export function builtinDashboard(key: string): BuiltinDashboard | undefined {
  return BUILTIN_DASHBOARDS.find((d) => d.key === key);
}

/** What Copy to customise posts for each widget, in board order. */
export function widgetPayload(w: BuiltinWidget): WidgetPayload {
  const fields = {
    title: w.title,
    subtitle: w.subtitle ?? null,
    viz: w.viz,
    size: w.size,
    filters: w.filters,
  };
  return w.kind === "panel"
    ? { ...fields, kind: "panel", panel: w.panel, query: {} }
    : { ...fields, kind: "metric", panel: null, query: w.query };
}

/** Column spans on the built-in board's six-column grid. */
export function builtinSpanClass(w: BuiltinWidget): string {
  if (w.half) return "@3xl/main:col-span-3";
  if (w.size === "lg") return "@3xl/main:col-span-6";
  if (w.size === "md") return "@3xl/main:col-span-4";
  return "@3xl/main:col-span-2";
}

/** What a widget is, for the copy dialog's list. */
export function widgetKindLabel(w: DashboardWidget): string {
  if (w.kind === "panel") {
    if (w.panel.startsWith("kpis_"))
      return `${KPI_ROWS[w.panel as KpiPanelKey].length} metrics`;
    if (w.panel === "user_trends" || w.panel === "revenue_trend")
      return "Line chart";
    if (w.panel === "acquisition_channels") return "Breakdown";
    if (w.panel === "retention") return "Retention";
    return "Top 5";
  }
  if (w.viz === "line") return "Line chart";
  if (w.viz === "number") return "Number";
  return w.query.limit === 5 && w.query.group_by !== "platform"
    ? "Top 5"
    : "Bar list";
}
