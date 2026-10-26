"use client";

import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useProjectSelection } from "@/context/useProjectSelection";
import { useUserContext } from "@/context/useUserContext";
import { useCreateInstanceMutation } from "@/hooks/mutations/useInstanceMutations";
import { useInstancesQuery } from "@/hooks/queries/useInstanceQueries";
import type { Instance } from "@/types";
import ProjectFormDialog from "../sidebar/ProjectFormDialog";
import { ProjectIcon } from "./project-icon";
import InviteLinkDialog, {
  type InviteLink,
  inviteLinksFromCreateResponse,
} from "@/components/settings/InviteLinkDialog";
import { IS_SELF_HOSTED } from "@/lib/edition";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setupHref } from "@/components/onboarding/setupRules";
import { showGenericError } from "@/lib/Notifications";
import { trackEvent, EVENTS } from "@/analytics";

export function ProjectSwitcher() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [inviteLinks, setInviteLinks] = useState<InviteLink[] | null>(null);
  const [setupAfterInvite, setSetupAfterInvite] = useState<string | null>(null);
  const router = useRouter();

  const { setSelectedInstance, selectedInstance } = useProjectSelection();
  const { fetchCurrentUser } = useUserContext();

  const { data: instances } = useInstancesQuery();

  const createInstanceMutation = useCreateInstanceMutation();

  // Load the setup page's code while the form is filled in, so the jump after Create is instant.
  useEffect(() => {
    if (dialogOpen) router.prefetch("/setup");
  }, [dialogOpen, router]);

  const { isMobile } = useSidebar();
  const handleSelectInstance = (instance: Instance) => {
    setSelectedInstance(instance);
  };

  const handleCreateInstance = async (
    projectName: string,
    members: {
      email: string;
      role: string;
    }[]
  ) => {
    const parsedMembers = members.map((item) => ({
      ...item,
      role: item.role, // in case it's a SelectItem object
    }));

    try {
      const response = await createInstanceMutation.mutateAsync({
        name: projectName,
        members: parsedMembers,
      });
      const instance = response.data.instance;
      trackEvent(EVENTS.PROJECT_CREATED, { projectName });
      setSelectedInstance(instance);
      const links = inviteLinksFromCreateResponse(response.data.invite_urls);
      if (links) setInviteLinks(links);
      // Without this the cached roles lack the new instance and AdminOnlyDisplay hides everything.
      // Awaiting it also lets the URL pick up the new project first; a later
      // replaceState would cancel the push below.
      await fetchCurrentUser().catch(() => {});
      setDialogOpen(false);
      // A new project goes straight into its guided setup, after any invite links are seen.
      if (links) setSetupAfterInvite(String(instance.id));
      else router.push(setupHref(instance.id));
    } catch {
      showGenericError();
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu
          onOpenChange={(open) => {
            if (!open) setSearchTerm("");
          }}
        >
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <ProjectIcon
                url={selectedInstance?.icon_url}
                name={
                  selectedInstance?.production?.name ?? selectedInstance?.name
                }
              />
              <div className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold tracking-tight">
                  {selectedInstance?.production?.name ?? selectedInstance?.name}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  Project
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground/50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuItem
              className="gap-2 p-2"
              onSelect={() => {
                setDialogOpen(true);
              }}
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="text-muted-foreground font-medium">
                Add Project
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Projects
            </DropdownMenuLabel>
            {(instances?.length ?? 0) > 10 && (
              <div className="px-2 pb-2">
                <div className="flex items-center gap-2 rounded-md border border-sidebar-border px-2 py-1.5">
                  <Search className="size-3.5 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}
            <div className="max-h-[calc(100vh-200px)] overflow-x-hidden overflow-y-auto">
              {instances
                ?.filter((project: Instance) =>
                  searchTerm === ""
                    ? true
                    : (project.production?.name ?? project.name ?? "")
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase())
                )
                .map((project: Instance) => {
                  const current = project.id === selectedInstance?.id;
                  return (
                    <DropdownMenuItem
                      key={project.id}
                      onClick={() => handleSelectInstance(project)}
                      aria-current={current ? "true" : undefined}
                      className={
                        current
                          ? "gap-2.5 overflow-hidden bg-muted p-2 font-medium focus:bg-muted"
                          : "gap-2.5 overflow-hidden p-2 focus:bg-muted"
                      }
                    >
                      <ProjectIcon
                        url={project.icon_url}
                        name={project.production?.name ?? project.name}
                        className="size-6 text-[11px]"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {project.production?.name ?? project.name}
                      </span>
                      {current && (
                        <Check className="size-4 shrink-0 text-[var(--chart-users)]" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              {(instances?.length ?? 0) > 10 &&
                searchTerm !== "" &&
                instances?.filter((project: Instance) =>
                  (project.production?.name ?? project.name ?? "")
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase())
                ).length === 0 && (
                  <p className="text-xs text-muted-foreground/60 text-center py-3">
                    No projects found
                  </p>
                )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <ProjectFormDialog
          variant="new-project"
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          handleCreateProject={handleCreateInstance}
        />
        {IS_SELF_HOSTED && (
          <InviteLinkDialog
            links={inviteLinks}
            onOpenChange={(open) => {
              if (open) return;
              setInviteLinks(null);
              if (setupAfterInvite) router.push(setupHref(setupAfterInvite));
              setSetupAfterInvite(null);
            }}
          />
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
