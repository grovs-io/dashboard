import {
  Activity,
  CircleDollarSign,
  LineChart,
  Link2,
  Megaphone,
  RotateCcw,
  Share2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { PanelKey } from "@/types";

export interface PanelMeta {
  key: PanelKey;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Key-metrics and trend panels follow widget and page chips; the rest see only dates and platform. */
  filtersHonoured: boolean;
}

export const PANEL_CATALOG: PanelMeta[] = [
  {
    key: "user_trends",
    label: "New users trend",
    description:
      "New users over time, with the previous period for comparison.",
    icon: LineChart,
    filtersHonoured: true,
  },
  {
    key: "acquisition_channels",
    label: "Acquisition channels",
    description: "Link-driven, organic and referred users.",
    icon: Share2,
    filtersHonoured: true,
  },
  {
    key: "top_links",
    label: "Top links",
    description: "Your five most viewed links.",
    icon: Link2,
    filtersHonoured: false,
  },
  {
    key: "top_campaigns",
    label: "Top campaigns",
    description: "Your five most viewed campaigns.",
    icon: Megaphone,
    filtersHonoured: false,
  },
  {
    key: "acquisition",
    label: "Acquisition",
    description: "Link views, installs and cancellations.",
    icon: UserPlus,
    filtersHonoured: true,
  },
  {
    key: "engagement",
    label: "Engagement",
    description: "App opens, returning users and returning rate.",
    icon: Activity,
    filtersHonoured: true,
  },
  {
    key: "revenue",
    label: "Revenue",
    description: "Revenue per user, units sold and first-time purchasers.",
    icon: CircleDollarSign,
    filtersHonoured: true,
  },
  {
    key: "retention",
    label: "Retention",
    description: "Day 1, 7 and 30 retention rates.",
    icon: RotateCcw,
    filtersHonoured: false,
  },
];

/** Panels the built-in dashboards use; not offered in the widget dialog. */
const BUILTIN_PANELS: PanelMeta[] = [
  {
    key: "kpis_acquisition",
    label: "Acquisition KPIs",
    description: "New users, installs, referrals and view → install.",
    icon: UserPlus,
    filtersHonoured: true,
  },
  {
    key: "kpis_engagement",
    label: "Engagement KPIs",
    description: "App opens, returning users and day 7 retention.",
    icon: Activity,
    filtersHonoured: true,
  },
  {
    key: "kpis_revenue",
    label: "Revenue KPIs",
    description: "Revenue, ARPU, ARPPU, units sold and first-time purchases.",
    icon: CircleDollarSign,
    filtersHonoured: true,
  },
  {
    key: "kpis_links",
    label: "Link KPIs",
    description: "Link views, installs and opens from links.",
    icon: Link2,
    filtersHonoured: true,
  },
  {
    key: "revenue_trend",
    label: "Revenue trend",
    description: "Revenue over time, with the previous period for comparison.",
    icon: LineChart,
    filtersHonoured: true,
  },
];

const BY_KEY = new Map(
  [...PANEL_CATALOG, ...BUILTIN_PANELS].map((p) => [p.key, p])
);

export function panelMeta(key: PanelKey): PanelMeta {
  return (
    BY_KEY.get(key) ?? {
      key,
      label: key,
      description: "",
      icon: Share2,
      filtersHonoured: false,
    }
  );
}

export const PANEL_DATE_ONLY_NOTE =
  "This panel follows the dashboard's date range and platform only.";
