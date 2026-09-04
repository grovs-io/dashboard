"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import CopyField from "./CopyField";
import { showErrorNotification } from "@/lib/Notifications";

export default function ScimTokenDialog({
  open,
  onOpenChange,
  rotating,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rotating: boolean;
  onCreate: () => Promise<string>;
}) {
  const [plainToken, setPlainToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The plain token must never outlive the dialog.
  useEffect(() => {
    if (!open) {
      setPlainToken(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      setPlainToken(await onCreate());
    } catch {
      showErrorNotification("Failed to generate the SCIM token");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !submitting && onOpenChange(next)}
    >
      <DialogContent>
        {plainToken ? (
          <>
            <DialogHeader>
              <DialogTitle>Copy your SCIM token</DialogTitle>
              <DialogDescription>
                Shown only once. Paste it as the secret token in your identity
                provider&apos;s provisioning settings.
              </DialogDescription>
            </DialogHeader>
            <CopyField
              id="scim-token"
              label="Secret token"
              value={plainToken}
            />
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {rotating ? "Rotate SCIM token" : "Generate SCIM token"}
              </DialogTitle>
              <DialogDescription>
                {rotating
                  ? "The current token stops working immediately. Update your identity provider with the new one."
                  : "A bearer token your identity provider uses to create and deactivate users."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={submitting}
                className="gap-1.5"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {rotating ? "Rotate" : "Generate"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
