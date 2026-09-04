"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApiErrorStatus, getApiErrorMessage } from "@/lib/apiErrorHelpers";
import { normalizeVerificationErrors } from "@/lib/verificationErrors";

export function verifyFailureNotice(err: unknown): string {
  return getApiErrorStatus(err) === 429
    ? "Too many attempts — wait a minute and try again."
    : getApiErrorMessage(err, "Couldn't verify right now. Please try again.");
}

// Shared by the custom-domain dialog and the migration wizard so the manual
// verification UX can't drift between them. Probe failures render verbatim.
const ManualVerifyPanel = ({
  errors,
  notice,
  onVerify,
  verifyPending,
}: {
  errors: unknown;
  notice?: string | null;
  onVerify: () => void;
  verifyPending: boolean;
}) => {
  const messages = normalizeVerificationErrors(errors);
  return (
    <div className="flex flex-col gap-3">
      {messages.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
          <span className="text-xs font-medium text-destructive">
            Last verification attempt
          </span>
          {messages.map((message, index) => (
            <p
              key={index}
              className="text-xs leading-relaxed text-muted-foreground"
            >
              {message}
            </p>
          ))}
        </div>
      )}

      {notice && (
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {notice}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground leading-relaxed">
          The domain activates automatically once DNS points here and the first
          traffic arrives — or check it now.
        </span>
        <Button
          variant="outline"
          size="sm"
          className="w-28 shrink-0 gap-1.5"
          disabled={verifyPending}
          onClick={onVerify}
        >
          {verifyPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {verifyPending ? "Verifying…" : "Verify now"}
        </Button>
      </div>
    </div>
  );
};

export default ManualVerifyPanel;
