import {
  BarChart3,
  Hash,
  LineChart,
  Table2,
  type LucideIcon,
} from "lucide-react";
import type { WidgetPayload } from "@/types/dashboards";

export interface WidgetTemplate {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  payload: WidgetPayload;
}

export const WIDGET_TEMPLATES: WidgetTemplate[] = [
  {
    key: "installs-by-country",
    title: "Installs by country",
    description: "Where your installs come from.",
    icon: BarChart3,
    payload: {
      kind: "metric",
      panel: null,
      title: "Installs by country",
      viz: "bar",
      size: "md",
      query: { metric: "installs", group_by: "country", limit: 10 },
      filters: [],
    },
  },
  {
    key: "daily-installs",
    title: "Daily installs",
    description: "Install trend over the selected range.",
    icon: LineChart,
    payload: {
      kind: "metric",
      panel: null,
      title: "Daily installs",
      viz: "line",
      size: "lg",
      query: { metric: "installs" },
      filters: [],
    },
  },
  {
    key: "unique-visitors",
    title: "Unique visitors",
    description: "One number, compared with the previous period.",
    icon: Hash,
    payload: {
      kind: "metric",
      panel: null,
      title: "Unique visitors",
      viz: "number",
      size: "sm",
      query: { metric: "unique_visitors", compare: true },
      filters: [],
    },
  },
  {
    key: "opens-by-version",
    title: "App opens by version",
    description: "Which app versions are in use.",
    icon: BarChart3,
    payload: {
      kind: "metric",
      panel: null,
      title: "App opens by version",
      viz: "bar",
      size: "md",
      query: { metric: "app_opens", group_by: "app_version", limit: 10 },
      filters: [],
    },
  },
  {
    key: "top-links",
    title: "Top links",
    description: "Links that drive the most installs.",
    icon: Table2,
    payload: {
      kind: "metric",
      panel: null,
      title: "Top links",
      viz: "table",
      size: "md",
      query: { metric: "link_driven_installs", group_by: "link_id", limit: 10 },
      filters: [],
    },
  },
  {
    key: "events-by-name",
    title: "Events by name",
    description: "Your most frequent events by name.",
    icon: BarChart3,
    payload: {
      kind: "metric",
      panel: null,
      title: "Events by name",
      viz: "bar",
      size: "md",
      query: { metric: "events", group_by: "event_name", limit: 10 },
      filters: [],
    },
  },
];
