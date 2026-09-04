"use client";

import { useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/copyTextHelper";
import { Copy, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";

export default function CreateAuditExportTokenDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<string>;
}) {
  const [name, setName] = useState("");
  const [plainToken, setPlainToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const openRef = useRef(open);

  // The plain token must never outlive the dialog.
  useEffect(() => {
    if (!open) {
      setName("");
      setPlainToken(null);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Don't let Escape/backdrop/X dismiss the dialog while a create is in flight.
  const handleOpenChange = (next: boolean) => {
    if (!next && submitting) return;
    onOpenChange(next);
  };

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const token = await onCreate(name.trim());
      // The dialog may have been closed while the request was in flight.
      if (openRef.current) {
        setPlainToken(token);
        showSuccessNotification("Token created");
      }
    } catch {
      showErrorNotification("Failed to create token");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!plainToken) return;
    try {
      if (!(await copyToClipboard(plainToken))) throw new Error("copy failed");
      showSuccessNotification("Copied");
    } catch {
      showErrorNotification(
        "Couldn't copy — select the token and copy it manually"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {plainToken ? (
          <>
            <DialogHeader>
              <DialogTitle>Copy your token</DialogTitle>
              <DialogDescription>
                This token is shown only once. Store it in your SIEM now.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={plainToken}
                className="font-mono text-xs"
                aria-label="Export token"
              />
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create export token</DialogTitle>
              <DialogDescription>
                A read-only token your SIEM uses to pull this audit log.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="audit-token-name">Name</Label>
              <Input
                id="audit-token-name"
                placeholder="Splunk"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
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
                disabled={submitting || name.trim().length === 0}
                className="gap-1.5"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
