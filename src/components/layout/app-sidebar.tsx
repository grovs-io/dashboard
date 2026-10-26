"use client";

import * as React from "react";

import { NavGroup, NavItem } from "@/components/layout/nav-main";
import { navGroups, navTrail } from "@/components/layout/navConfig";
import { usePathname } from "next/navigation";
import { ProjectSwitcher } from "@/components/layout/team-switcher";
import { SetupSidebarEntry } from "@/components/layout/SetupSidebarEntry";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavUser } from "@/components/layout/nav-user";
import { useProjectSelection } from "@/context/useProjectSelection";
import { useAuditLogAccess } from "@ee/hooks/queries/useAuditQueries";

const OPEN_KEY = "grovs.sidebar.openGroups";

// Groups the user opened, remembered across reloads. The group holding the
// current page opens on arrival, however the user got there.
function useOpenGroups(activeGroup?: string) {
  const [openGroups, setOpenGroups] = React.useState<string[]>(
    activeGroup ? [activeGroup] : []
  );
  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "[]");
      if (Array.isArray(saved))
        setOpenGroups((prev) => [
          ...new Set([...prev, ...saved.filter((l) => typeof l === "string")]),
        ]);
    } catch {}
  }, []);
  const [lastActive, setLastActive] = React.useState(activeGroup);
  if (activeGroup !== lastActive) {
    setLastActive(activeGroup);
    if (activeGroup && !openGroups.includes(activeGroup))
      setOpenGroups([...openGroups, activeGroup]);
  }
  const setOpen = (label: string, open: boolean) =>
    setOpenGroups((prev) => {
      const next = open
        ? [...prev.filter((l) => l !== label), label]
        : prev.filter((l) => l !== label);
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  return { openGroups, setOpen };
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { selectedInstance } = useProjectSelection();
  const { allowed: auditAllowed } = useAuditLogAccess(selectedInstance?.id);
  const pathname = usePathname();
  const trail = navTrail(pathname)?.trail ?? [];
  // A one-crumb trail is a flat item like Home, not a group.
  const activeGroup = trail.length > 1 ? trail[0]?.label : undefined;
  const { openGroups, setOpen } = useOpenGroups(activeGroup);

  const groups = React.useMemo(
    () => navGroups(auditAllowed).filter((group) => group.items.length > 0),
    [auditAllowed]
  );
  const menu = (
    <SidebarMenu>
      {groups.flatMap((group) =>
        group.label
          ? [
              <NavGroup
                key={group.label}
                label={group.label}
                icon={group.icon}
                items={group.items}
                active={group.label === activeGroup}
                open={openGroups.includes(group.label)}
                onOpenChange={(open) => setOpen(group.label!, open)}
              />,
            ]
          : group.items.map((item) => <NavItem key={item.title} item={item} />)
      )}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="h-[calc(4rem+1px)] border-b border-sidebar-border justify-center">
        <ProjectSwitcher />
      </SidebarHeader>
      <SidebarContent role="navigation" aria-label="Main navigation">
        <SidebarGroup className="pt-2 pb-0 empty:hidden">
          <SetupSidebarEntry />
        </SidebarGroup>
        <SidebarGroup className="py-2">{menu}</SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border gap-0">
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
