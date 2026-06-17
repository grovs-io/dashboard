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

// Self-hosted: shown after inviting a member so the admin can copy the invite
// link to share manually (no email is sent).
const InviteLinkDialog = ({
  inviteUrl,
  onOpenChange,
}: {
  inviteUrl: string | null;
  onOpenChange: (open: boolean) => void;
}) => {
  return (
    <Dialog open={inviteUrl !== null} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col w-full max-w-[600px] gap-4"
      >
        <DialogHeader>
          <div className="flex items-center gap-4 w-full">
            <DialogTitle className="font-semibold text-lg">
              Invite link
            </DialogTitle>
            <DialogClose className="ml-auto" aria-label="Close dialog">
              <X />
            </DialogClose>
          </div>
        </DialogHeader>

        <span className="text-sm text-muted-foreground">
          Share this link with the new member so they can set a password and
          join. It works without email.
        </span>

        <div className="flex items-center gap-2">
          <Input readOnly value={inviteUrl ?? ""} aria-label="Invite link" />
          <Button
            type="button"
            onClick={() => inviteUrl && handleCopyText(inviteUrl)}
          >
            <Copy className="h-4 w-4" />
            Copy
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteLinkDialog;
