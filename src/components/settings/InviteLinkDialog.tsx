import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Copy, X } from "lucide-react";
import { handleCopyText } from "@/lib/copyTextHelper";
import { IS_SELF_HOSTED } from "@/lib/edition";

export interface InviteLink {
  email?: string;
  url: string;
}

// Self-hosted only: maps a create-instance response's invite_urls into dialog links.
export function inviteLinksFromCreateResponse(
  inviteUrls?: Record<string, string>
): InviteLink[] | null {
  if (!IS_SELF_HOSTED || !inviteUrls) return null;
  const links = Object.entries(inviteUrls).map(([email, url]) => ({
    email,
    url,
  }));
  return links.length > 0 ? links : null;
}

// Self-hosted: shown after inviting members so the admin can copy the invite
// link(s) to share manually (works even when no email could be delivered).
const InviteLinkDialog = ({
  links,
  onOpenChange,
}: {
  links: InviteLink[] | null;
  onOpenChange: (open: boolean) => void;
}) => {
  const many = (links?.length ?? 0) > 1;
  return (
    <Dialog
      open={links !== null && links.length > 0}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        showCloseButton={false}
        className="flex flex-col w-full max-w-[600px] gap-4"
      >
        <DialogHeader>
          <div className="flex items-center gap-4 w-full">
            <DialogTitle className="font-semibold text-lg">
              {many ? "Invite links" : "Invite link"}
            </DialogTitle>
            <DialogClose className="ml-auto" aria-label="Close dialog">
              <X />
            </DialogClose>
          </div>
        </DialogHeader>

        <span className="text-sm text-muted-foreground">
          {many
            ? "Share each link with the corresponding member so they can set a password and join. They work without email."
            : "Share this link with the new member so they can set a password and join. It works without email."}
        </span>

        {links?.map(({ email, url }) => (
          <div key={url} className="flex flex-col gap-1">
            {email && <span className="text-sm font-medium">{email}</span>}
            <div className="flex items-center gap-2">
              <Input readOnly value={url} aria-label="Invite link" />
              <Button type="button" onClick={() => handleCopyText(url)}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
};

export default InviteLinkDialog;
