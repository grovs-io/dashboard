"use client";
import { useId, useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { copyToClipboard } from "@/lib/copyTextHelper";

export default function SecretDialog({
  value,
  kind,
  onClose,
}: {
  value: string;
  kind: "webhook" | "token";
  onClose: () => void;
}) {
  const id = useId();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle"
  );
  const label = kind === "webhook" ? "Signing secret" : "Feed token";
  const copy = async () => {
    try {
      setCopyStatus((await copyToClipboard(value)) ? "copied" : "failed");
    } catch {
      setCopyStatus("failed");
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] max-w-[calc(100vw_-_2rem)] overflow-y-auto sm:max-w-2xl ph-no-capture ph-mask">
        <DialogHeader className="text-left">
          <DialogTitle>
            {kind === "webhook" ? "Destination created" : "Feed token created"}
          </DialogTitle>
          <DialogDescription>
            {kind === "webhook"
              ? "Use this signing secret to verify events sent to your webhook."
              : "Use this token to read events from your integration."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={id} className="text-xs text-muted-foreground">
              {label}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={id}
                readOnly
                value={value}
                spellCheck={false}
                aria-describedby={`${id}-notice`}
                className="min-w-0 font-mono text-xs"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button type="button" variant="outline" size="sm" onClick={copy}>
                {copyStatus === "copied" ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copyStatus === "copied" ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
          <p id={`${id}-notice`} className="text-sm text-muted-foreground">
            Copy this {kind === "webhook" ? "secret" : "token"} before closing.
            You won’t be able to view it again.
          </p>
          <p role="status" className="text-xs text-muted-foreground">
            {copyStatus === "failed"
              ? "Couldn’t copy. Select the value and copy it manually."
              : copyStatus === "copied"
                ? "Copied to clipboard."
                : ""}
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
