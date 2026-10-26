import {
  House,
  Activity,
  DollarSign,
  Link2,
  Megaphone,
  PanelTop,
  PencilRuler,
  Users,
  Share2,
  UserSearch,
  BellRing,
  AppWindow,
  Route,
  SlidersHorizontal,
  UsersRound,
  CreditCard,
  ScrollText,
  KeyRound,
  Code,
  ArrowLeftRight,
  Globe,
  Settings,
  ChartColumn,
  Waypoints,
  Contact,
  MessagesSquare,
  Terminal,
  type LucideIcon,
} from "lucide-react";

import { AndroidIcon, AppleIcon } from "@/components/icons/PlatformIcons";
import { IS_ENTERPRISE } from "@/lib/edition";
import { SMART_BANNERS_PATH } from "@/lib/smartBannerRoutes";
import type { navItemType } from "@/components/layout/nav-main";

// The sidebar's structure; breadcrumbs read it too so the two always agree.
// Unlabelled groups render as flat rows; labelled ones as a collapsible row.
export type navGroupType = {
  label?: string;
  icon?: LucideIcon;
  items: navItemType[];
};

const ee = <T>(items: T[]): T[] => (IS_ENTERPRISE ? items : []);

const page = (
  title: string,
  url: string,
  icon: navItemType["icon"]
): navItemType => ({ title, url, icon, itemType: "simple" });

const appGroups: navGroupType[] = [
  { items: [page("Home", "/dashboard", House)] },
  {
    label: "Links",
    icon: Waypoints,
    items: [
      page("Dynamic Links", "/dynamic_links/links", Link2),
      page("Campaigns", "/dynamic_links/campaigns", Megaphone),
      page("Smart Banners", SMART_BANNERS_PATH, PanelTop),
      {
        // "#": only the current child is highlighted, not this row too.
        title: "Link Settings",
        url: "#",
        icon: PencilRuler,
        itemType: "collapsible",
        items: [
          {
            title: "Redirect Rules",
            url: "/dynamic_links/settings/redirect_rules",
          },
          { title: "Domain", url: "/dynamic_links/settings/domain" },
          {
            title: "Social Preview",
            url: "/dynamic_links/settings/social_media_preview",
          },
          { title: "Tracking", url: "/dynamic_links/settings/tracking" },
        ],
      },
    ],
  },
  {
    label: "Audience",
    icon: Contact,
    items: [
      page("Visitors", "/audience/visitors", Users),
      page("Referrals", "/audience/referrals", Share2),
      ...ee([page("Segments", "/segments", UserSearch)]),
    ],
  },
  ...ee<navGroupType>([
    {
      label: "Engage",
      icon: MessagesSquare,
      items: [
        page("Push", "/push", BellRing),
        page("In-App", "/in_app", AppWindow),
        page("Journeys", "/journeys", Route),
        page("Engagement Settings", "/engagement_settings", SlidersHorizontal),
      ],
    },
  ]),
  {
    label: "Analytics",
    icon: ChartColumn,
    items: [
      page("Events", "/analytics/event_log", Activity),
      ...ee([page("Revenue", "/revenue", DollarSign)]),
    ],
  },
];

const developerItems: navItemType[] = [
  page("API Key", "/settings/developers/access_key", KeyRound),
  {
    title: "SDK Setup",
    url: "#",
    icon: Code,
    itemType: "collapsible",
    items: [
      { title: "iOS", url: "/settings/developers/ios_setup", icon: AppleIcon },
      {
        title: "Android",
        url: "/settings/developers/android_setup",
        icon: AndroidIcon,
      },
      { title: "Web", url: "/settings/developers/web_setup", icon: Globe },
    ],
  },
  ...ee([
    page("Data Export", "/settings/developers/event_stream", ArrowLeftRight),
  ]),
];

// Audit Logs only for admins on an entitled instance.
export const navGroups = (auditAllowed: boolean): navGroupType[] => [
  ...appGroups,
  {
    label: "Developers",
    icon: Terminal,
    items: developerItems,
  },
  {
    label: "Settings",
    icon: Settings,
    items: [
      page("Team", "/settings/team", UsersRound),
      page("Usage & Billing", "/settings/usage", CreditCard),
      ...(auditAllowed
        ? [page("Audit Logs", "/settings/audit_logs", ScrollText)]
        : []),
    ],
  },
];

export type crumb = { label: string; href?: string };

const isUnder = (path: string, url: string) =>
  path === url || path.startsWith(`${url}/`);

// Section › (parent ›) page for the sidebar entry holding `pathname`, plus the
// URL that matched so callers can add crumbs for deeper detail routes.
export const navTrail = (
  pathname: string
): { trail: crumb[]; matchedUrl: string } | null => {
  let best: { trail: crumb[]; matchedUrl: string } | null = null;
  const consider = (url: string, trail: crumb[]) => {
    if (!isUnder(pathname, url)) return;
    if (!best || url.length > best.matchedUrl.length)
      best = { trail, matchedUrl: url };
  };
  for (const group of navGroups(true)) {
    const section = group.label ? [{ label: group.label }] : [];
    for (const item of group.items) {
      if (item.items) {
        for (const child of item.items)
          consider(child.url, [
            ...section,
            { label: item.title },
            { label: child.title, href: child.url },
          ]);
      } else {
        consider(item.url, [...section, { label: item.title, href: item.url }]);
      }
    }
  }
  return best;
};

// Nav and breadcrumb links keep the project and environment, not page state like filters.
export const withNavQuery = (
  url: string,
  searchParams: { get: (key: string) => string | null }
) => {
  const kept = new URLSearchParams();
  for (const key of ["instance_id", "env_type"]) {
    const value = searchParams.get(key);
    if (value) kept.set(key, value);
  }
  const query = kept.toString();
  return query ? `${url}?${query}` : url;
};
