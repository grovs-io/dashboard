"use client";

import { useState } from "react";
import { MEMBER_ROLE } from "@/constants/OptionsConstants";
import { useAddMemberMutation } from "@/hooks/mutations/useInstanceMutations";
import { useInstanceMembersQuery } from "@/hooks/queries/useInstanceQueries";
import { useUserContext } from "@/context/useUserContext";
import { getApiErrorMessage } from "@/lib/apiErrorHelpers";
import { IS_SELF_HOSTED } from "@/lib/edition";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addMemberSchema } from "@/schemas/member";
import {
  CopyField,
  ErrorText,
  FieldLabel,
  PrimaryButton,
  QuietButton,
  SetupInput,
} from "./primitives";

/** Invites a developer to the project and hands over a link back to this step. */
export const SendToDeveloperDialog = ({
  open,
  onOpenChange,
  instanceId,
  link,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  link: string;
}) => {
  const invite = useAddMemberMutation(instanceId);
  const [email, setEmail] = useState("");
  const { user } = useUserContext();
  const { data: members } = useInstanceMembersQuery(
    open ? instanceId : undefined
  );
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);
  // Self-hosted sends no email; the invitee accepts through this link.
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const valid = addMemberSchema.shape.email.safeParse(email.trim()).success;

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setEmail("");
      setSentTo(null);
      setAlreadyMember(false);
      setInviteUrl(null);
      setError(null);
    }
  };

  const send = async () => {
    setError(null);
    const address = email.trim().toLowerCase();
    if (address === user?.email?.toLowerCase()) {
      setError("That's your own email. Enter your developer's.");
      return;
    }
    // The invite endpoint rejects people already in the project; they only need the link.
    const member = members?.members?.some(
      (m: { user: { email?: string } }) =>
        m.user.email?.toLowerCase() === address
    );
    if (member) {
      setAlreadyMember(true);
      setSentTo(email.trim());
      return;
    }
    try {
      const res = await invite.mutateAsync({
        email: email.trim(),
        role: MEMBER_ROLE,
      });
      if (IS_SELF_HOSTED && res?.data?.invite_url) {
        setInviteUrl(res.data.invite_url);
      }
      setSentTo(email.trim());
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't send the invite. Try again."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="grid-cols-[minmax(0,1fr)] sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Send to your developer</DialogTitle>
          <DialogDescription>
            {sentTo
              ? alreadyMember
                ? `${sentTo} is already in the project. Send them this link to land on this step.`
                : inviteUrl
                  ? `Send ${sentTo} the invite link to join the project first, then the link to this step.`
                  : `We emailed ${sentTo} an invite to the project. Send them this link to land on this step.`
              : "They get an invite to the project and a link straight to this step."}
          </DialogDescription>
        </DialogHeader>
        {sentTo ? (
          <>
            {inviteUrl && <CopyField label="Invite link" value={inviteUrl} />}
            <CopyField label="Link to this step" value={link} />
            <div className="flex justify-end">
              <PrimaryButton onClick={() => close(false)}>Done</PrimaryButton>
            </div>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) void send();
            }}
          >
            <FieldLabel htmlFor="onb-dev-email">Their email</FieldLabel>
            <SetupInput
              id="onb-dev-email"
              type="email"
              tone="plain"
              mono={false}
              value={email}
              onChange={setEmail}
              placeholder="dev@company.com"
              autoFocus
            />
            {error && <ErrorText>{error}</ErrorText>}
            <div className="mt-5 flex justify-end gap-2">
              <QuietButton type="button" onClick={() => close(false)}>
                Cancel
              </QuietButton>
              <PrimaryButton
                type="submit"
                disabled={!valid || invite.isPending}
              >
                Send invite
              </PrimaryButton>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
