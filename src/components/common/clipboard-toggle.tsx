"use client";

import { ClipboardCopy } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const ClipboardToggle = ({
  checked,
  onCheckedChange,
  id,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id: string;
  disabled?: boolean;
}) => (
  <div className="flex items-start gap-3 rounded-lg border border-sidebar-border bg-muted/30 p-4">
    <div className="flex items-center justify-center h-8 w-8 rounded-lg border border-sidebar-border bg-background shrink-0">
      <ClipboardCopy className="h-4 w-4 text-muted-foreground" />
    </div>
    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
      <label htmlFor={id} className="text-sm font-medium">
        Copy link to clipboard
      </label>
      <span className="text-xs text-muted-foreground leading-snug">
        Copies the link when users tap through the preview page, so the SDK can
        match an install to the exact click instead of guessing from the device
        fingerprint.
      </span>
    </div>
    <Switch
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
    />
  </div>
);

export default ClipboardToggle;
