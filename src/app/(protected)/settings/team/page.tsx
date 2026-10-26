"use client";

import TeamMebersSection from "@/components/settings/TeamMebersSection";
import InviteLinkDialog from "@/components/settings/InviteLinkDialog";
import AppHeader from "@/components/layout/app-header";
import { Separator } from "@/components/ui/separator";
import { useProjectSelection } from "@/context/useProjectSelection";
import { useInstanceMembersQuery } from "@/hooks/queries/useInstanceQueries";
import {
  useAddMemberMutation,
  useRemoveMemberMutation,
} from "@/hooks/mutations/useInstanceMutations";
import type { InstanceMember } from "@/types";
import { trackEvent, EVENTS } from "@/analytics";
import { showGenericError, showSuccessNotification } from "@/lib/Notifications";
import { deepClone } from "@/lib/utils";
import { useMemo, useState } from "react";
import { IS_SELF_HOSTED } from "@/lib/edition";
import SsoSection from "@ee/components/settings/sso/SsoSection";
import { useSsoAccess } from "@ee/hooks/queries/useSsoQueries";

// Team: who has access to this project, and how they sign in (SSO).
const TeamSettingsPage = () => {
  const { selectedInstance } = useProjectSelection();
  const membersQuery = useInstanceMembersQuery(selectedInstance?.id);
  const addMemberMutation = useAddMemberMutation(selectedInstance?.id);
  const removeMemberMutation = useRemoveMemberMutation(selectedInstance?.id);
  const ssoAccess = useSsoAccess(selectedInstance?.id);

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  // Derive parsed members from TanStack Query data
  const parsedMembers = useMemo((): InstanceMember[] => {
    if (!membersQuery.data?.members) return [];
    const clone = deepClone(membersQuery.data.members);
    return clone.map(
      (member: {
        user: { id: string; name?: string; email: string };
        role: string;
      }) => ({
        id: member.user.id,
        name: member.user.name || "Invited",
        email: member.user.email,
        role: member.role,
      })
    );
  }, [membersQuery.data]);

  const handleInviteMember = async (email: string, role: string) => {
    try {
      const res = await addMemberMutation.mutateAsync({ email, role });
      trackEvent(EVENTS.TEAM_MEMBER_INVITED);
      // Members query auto-invalidated by mutation
      setInviteDialogOpen(false);
      // Self-hosted: surface the copyable invite link (no email is sent).
      if (IS_SELF_HOSTED && res?.data?.invite_url) {
        setInviteLink(res.data.invite_url);
      }
    } catch {
      showGenericError();
    }
  };

  const handleRemoveMember = async (email: string) => {
    try {
      await removeMemberMutation.mutateAsync(email);

      showSuccessNotification("The user was deleted");
      // Members query auto-invalidated by mutation
    } catch {
      showGenericError();
    }
  };

  return (
    <div className="flex flex-col relative overflow-hidden h-dvh">
      {IS_SELF_HOSTED && (
        <InviteLinkDialog
          links={inviteLink ? [{ url: inviteLink }] : null}
          onOpenChange={(open) => !open && setInviteLink(null)}
        />
      )}

      <div className="border-b border-sidebar-border">
        <AppHeader hideEnvSelect />
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-[800px] px-6 py-8">
          <TeamMebersSection
            members={parsedMembers}
            setMembers={() => {}}
            handleRemoveMember={handleRemoveMember}
            handleInviteMember={handleInviteMember}
            inviteDialogOpen={inviteDialogOpen}
            setInviteDialogOpen={setInviteDialogOpen}
          />

          {ssoAccess.allowed && selectedInstance?.id && (
            <>
              <Separator className="my-8" />
              <SsoSection instanceId={selectedInstance.id} />
            </>
          )}

          <div className="h-12" />
        </div>
      </div>
    </div>
  );
};

export default TeamSettingsPage;
