// /app/(protected)/ClientLayout.tsx
"use client";

import ProjectFormDialog from "@/components/sidebar/ProjectFormDialog";
import InviteLinkDialog, {
  type InviteLink,
  inviteLinksFromCreateResponse,
} from "@/components/settings/InviteLinkDialog";
import { IS_SELF_HOSTED } from "@/lib/edition";
import { TEST } from "@/constants/OptionsConstants";
import { useProjectSelection } from "@/context/useProjectSelection";
import {
  useInstancesQuery,
  useInstanceDetailsQuery,
} from "@/hooks/queries/useInstanceQueries";
import { useCreateInstanceMutation } from "@/hooks/mutations/useInstanceMutations";
import {
  useSubscriptionQuery,
  useMauQuery,
} from "@/hooks/queries/usePaymentsQueries";
import { showErrorNotification, showGenericError } from "@/lib/Notifications";
import { useRouter, useSearchParams } from "next/navigation";
import { setupHref } from "@/components/onboarding/setupRules";
import type { Instance } from "@/types";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useUserContext } from "@/context/useUserContext";
import { writeSearchParams } from "@/lib/searchParamsUrl";
import { chooseInstance } from "@/lib/projectSearchParams";
import { readLastSelection, writeLastSelection } from "@/lib/lastSelection";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const {
    setSelectedProject,
    selectedInstance,
    setSelectedInstance,
    projectType,
    setProjectType,
    setGetStartedSetup,
  } = useProjectSelection();

  const { fetchCurrentUser } = useUserContext();

  // TanStack Query hooks
  const instancesQuery = useInstancesQuery();
  const createInstanceMutation = useCreateInstanceMutation();
  const [inviteLinks, setInviteLinks] = useState<InviteLink[] | null>(null);

  // TanStack Query hooks auto-fetch when selectedInstance changes
  useSubscriptionQuery(selectedInstance?.id);
  useMauQuery(selectedInstance?.id);
  const instanceDetailsQuery = useInstanceDetailsQuery(selectedInstance?.id);

  const firstLoginRef = useRef(false);
  const hasInitializedRef = useRef(false);

  const noProjects = instancesQuery.data?.length === 0;
  // The first-project form leads into setup; load that page's code while it's filled in.
  useEffect(() => {
    if (noProjects) router.prefetch("/setup");
  }, [noProjects, router]);

  const updateSearchParams = useCallback(
    (paramsObj: Record<string, string | (string | number | undefined)>) => {
      writeSearchParams(paramsObj);
    },
    []
  );

  // The URL wins; a page reached without params falls back to what was last chosen on this browser.
  const initializeFromParams = useCallback(() => {
    const projectType =
      searchParams.get("env_type") ?? readLastSelection()?.env_type;
    if (projectType) {
      setProjectType(projectType);
    }
  }, [searchParams, setProjectType]);

  const handleInstanceResponse = useCallback(
    (sortedInstances: Instance[]) => {
      if (sortedInstances.length === 0) return;
      const currentParams = new URLSearchParams(window.location.search);
      const { instance, denied } = chooseInstance(
        sortedInstances,
        currentParams.get("instance_id"),
        readLastSelection()?.instance_id
      );
      if (denied)
        showErrorNotification(`You don't have access to this project`);
      else if (!currentParams.get("instance_id")) firstLoginRef.current = true;
      setSelectedInstance(instance);
    },
    [setSelectedInstance]
  );

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
      setSelectedInstance(instance);
      const links = inviteLinksFromCreateResponse(response.data.invite_urls);
      if (links) setInviteLinks(links);
      // Also lets the URL pick up the new project first; a later replaceState would cancel the push.
      await fetchCurrentUser().catch(() => {});
      // The invite links dialog lives here too, so it stays up over the setup.
      router.push(setupHref(instance.id));
    } catch {
      showGenericError();
    }
  };

  // On initial load, initialize from URL params and handle instance selection
  useEffect(() => {
    initializeFromParams();
  }, [initializeFromParams]);

  // When instances data arrives from TanStack Query, handle selection
  useEffect(() => {
    if (!instancesQuery.data || instancesQuery.data.length === 0) return;
    if (hasInitializedRef.current) {
      // After initial load, update selected instance with fresh data
      if (selectedInstance) {
        const updated = instancesQuery.data.find(
          (i) => String(i.id) === String(selectedInstance.id)
        );
        if (updated) {
          if (updated !== selectedInstance) {
            setSelectedInstance(updated);
          }
        }
        // Don't fall through — keep the current selection even if not yet
        // in the refetched list (e.g. just-created instance)
        return;
      }
    }
    handleInstanceResponse(instancesQuery.data);
    hasInitializedRef.current = true;
  }, [
    instancesQuery.data,
    handleInstanceResponse,
    selectedInstance,
    setSelectedInstance,
  ]);

  // Handle error from instances query
  useEffect(() => {
    if (instancesQuery.isError) {
      showGenericError();
    }
  }, [instancesQuery.isError]);

  // Sync getStartedSetup into context so all pages can read it
  useEffect(() => {
    if (instanceDetailsQuery.data?.get_started_setup) {
      setGetStartedSetup(instanceDetailsQuery.data.get_started_setup);
    }
  }, [instanceDetailsQuery.data, setGetStartedSetup]);

  useEffect(() => {
    if (!selectedInstance) {
      return;
    }
    if (projectType === TEST) {
      setSelectedProject(selectedInstance.test);
    } else {
      setSelectedProject(selectedInstance.production);
    }

    updateSearchParams({
      env_type: projectType,
      instance_id: selectedInstance.id,
    });
    writeLastSelection({
      instance_id: String(selectedInstance.id),
      env_type: projectType,
    });
  }, [projectType, selectedInstance, setSelectedProject, updateSearchParams]);

  return (
    <>
      {instancesQuery.data?.length === 0 && (
        <ProjectFormDialog
          variant="first-project"
          open={true}
          handleCreateProject={handleCreateInstance}
        />
      )}
      {IS_SELF_HOSTED && (
        <InviteLinkDialog
          links={inviteLinks}
          onOpenChange={(open) => !open && setInviteLinks(null)}
        />
      )}
      {children}
    </>
  );
}
