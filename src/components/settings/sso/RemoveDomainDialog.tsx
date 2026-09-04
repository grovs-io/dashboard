"use client";

import { useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
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

// Two gates on purpose: a verified domain is how a whole team signs in.
export default function RemoveDomainDialog({
  domain,
  verified,
  onOpenChange,
  onConfirm,
}: {
  domain: string | null;
  verified: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const open = domain !== null;

  useEffect(() => {
    if (!open) {
      setStep(1);
      setTyped("");
      setSubmitting(false);
    }
  }, [open]);

  const matches = typed.trim().toLowerCase() === domain;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
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
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-destructive" />
                Remove {domain}?
              </DialogTitle>
              <DialogDescription>
                {verified
                  ? "Everyone with an email address on this domain loses the ability to sign in through your identity provider. Their accounts and roles are kept, but they will need a password or a different domain to get back in."
                  : "This domain has not been verified yet, so nobody is signing in with it. Removing it only discards the pending record."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Keep domain
              </Button>
              <Button variant="destructive" onClick={() => setStep(2)}>
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Type the domain to confirm</DialogTitle>
              <DialogDescription>
                Enter <span className="font-mono">{domain}</span> exactly as
                shown to remove it.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sso-remove-domain-confirm">Domain</Label>
              <Input
                id="sso-remove-domain-confirm"
                autoFocus
                autoComplete="off"
                placeholder={domain ?? ""}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && matches && !submitting)
                    void handleConfirm();
                }}
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
                variant="destructive"
                onClick={handleConfirm}
                disabled={!matches || submitting}
                className="gap-1.5"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Remove domain
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
