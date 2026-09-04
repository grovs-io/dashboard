"use client";

import * as React from "react";
import {
  ChartNoAxesCombined,
  Activity,
  Link2,
  Users,
  DollarSign,
  MessageSquareText,
  Settings2,
  PencilRuler,
  SquareTerminal,
  ScrollText,
} from "lucide-react";

import { NavMain } from "@/components/layout/nav-main";
import { NavProjects } from "@/components/layout/nav-projects";
import { NavUser } from "@/components/layout/nav-user";
import { ProjectSwitcher } from "@/components/layout/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { NavSupport } from "@/components/layout/nav-support";
import { IS_ENTERPRISE } from "@/lib/edition";
import { useProjectSelection } from "@/context/useProjectSelection";
import { useAuditLogAccess } from "@/hooks/queries/useAuditQueries";
import type { navItemType } from "@/components/layout/nav-main";

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: ChartNoAxesCombined,
      itemType: "simple",
    },
    {
      title: "Events",
      url: "/analytics/event_log",
      icon: Activity,
      itemType: "simple",
    },
    {
      title: "Dynamic Links",
      url: "#",
      icon: Link2,
      itemType: "collapsible",
      items: [
        {
          title: "Links",
          url: "/dynamic_links/links",
        },
        {
          title: "Campaigns",
          url: "/dynamic_links/campaigns",
        },
      ],
    },
    {
      title: "Audience",
      url: "#",
      icon: Users,
      itemType: "collapsible",
      items: [
        {
          title: "Visitors",
          url: "/audience/visitors",
        },
        {
          title: "Referrals",
          url: "/audience/referrals",
        },
      ],
    },
    ...(IS_ENTERPRISE
      ? [
          {
            title: "Revenue",
            url: "/revenue",
            icon: DollarSign,
            itemType: "simple",
          },
        ]
      : []),
    {
      title: "Messaging",
      url: "/messaging",
      icon: MessageSquareText,
      itemType: "simple",
    },
  ],

  projects: [
    {
      title: "Links Behaviour",
      url: "/link_behaviour",
      icon: PencilRuler,
      itemType: "collapsible",
      items: [
        {
          title: "Redirect Rules",
          url: "/link_behaviour/redirect_rules",
        },
        {
          title: "Domain",
          url: "/link_behaviour/domain",
        },
        {
          title: "Social Media Preview",
          url: "/link_behaviour/social_media_preview",
        },
        {
          title: "Tracking",
          url: "/link_behaviour/tracking",
        },
      ],
    },
    {
      title: "Developers",
      url: "/developers",
      icon: SquareTerminal,
      itemType: "collapsible",
      items: [
        {
          title: "Access Key",
          url: "/developers/access_key",
        },
        {
          title: "Android Setup",
          url: "/developers/android_setup",
        },
        {
          title: "iOS Setup",
          url: "/developers/ios_setup",
        },
        {
          title: "Web Setup",
          url: "/developers/web_setup",
        },
      ],
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings2,
      itemType: "simple",
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { selectedInstance } = useProjectSelection();
  const { allowed: auditAllowed } = useAuditLogAccess(selectedInstance?.id);

  // Audit Logs sits alongside Settings in the Configuration group, and only
  // for admins on an entitled instance.
  const configItems: navItemType[] = React.useMemo(
    () =>
      auditAllowed
        ? [
            ...data.projects,
            {
              title: "Audit Logs",
              url: "/audit_logs",
              icon: ScrollText,
              itemType: "simple",
            },
          ]
        : data.projects,
    [auditAllowed]
  );

  return (
    <Sidebar collapsible="icon" aria-label="Main navigation" {...props}>
      <SidebarHeader className="h-[calc(4rem+1px)] border-b border-sidebar-border justify-center">
        <ProjectSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects items={configItems} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border gap-0">
        <NavSupport />
        <SidebarSeparator className="mx-0 my-1" />
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
