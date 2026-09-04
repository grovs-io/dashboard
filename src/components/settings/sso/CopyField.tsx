"use client";

import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";

export default function CopyField({
  id,
  label,
  value,
  className,
}: {
  id: string;
  label: string;
  value: string;
  className?: string;
}) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      showSuccessNotification("Copied");
    } catch {
      showErrorNotification(
        "Couldn't copy — select the value and copy it manually"
      );
    }
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <Input id={id} readOnly value={value} className="font-mono text-xs" />
        <Button variant="outline" size="sm" type="button" onClick={handleCopy}>
          <Copy className="h-3.5 w-3.5" />
          Copy
        </Button>
      </div>
    </div>
  );
}
