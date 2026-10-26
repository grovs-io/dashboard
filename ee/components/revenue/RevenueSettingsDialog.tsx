"use client";
import { useState } from "react";
import { Power } from "lucide-react";
import ActionConfirm from "@/components/common/action-confirm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admin: boolean;
  enabled: boolean;
  saving: boolean;
  onSave: (enabled: boolean) => Promise<void>;
}

// Mirrors InAppSettingsDialog. Collection is instance-wide, so one switch
// covers Production and Test; turning it off asks first.
export default function RevenueSettingsDialog({
  open,
  onOpenChange,
  admin,
  enabled,
  saving,
  onSave,
}: Props) {
  const [value, setValue] = useState(enabled);
  const [confirmOff, setConfirmOff] = useState(false);
  const dirty = value !== enabled;

  const close = () => {
    setValue(enabled);
    onOpenChange(false);
  };
  // close() resets the draft to `enabled`, so a failed save can't leave it stale.
  const save = async () => {
    await onSave(value);
    close();
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      >
        <DialogContent className="gap-0 p-0 sm:max-w-[520px]">
          <DialogHeader className="border-b border-sidebar-border p-5">
            <DialogTitle className="text-[15px]">Revenue settings</DialogTitle>
            <DialogDescription>
              These hold for this project in both Production and Test.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-5">
            <section
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3.5",
                value
                  ? "border-sidebar-border"
                  : "border-destructive/30 bg-destructive/5"
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                <Power className="size-3.5" />
              </span>
              <label
                htmlFor="revenue-enabled"
                className="min-w-0 flex-1 text-[13px]"
              >
                <span className="font-semibold">
                  {value ? "Revenue tracking is on" : "Revenue tracking is off"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {value
                    ? "Purchases and revenue events from the SDKs and API are collected and attributed to links and campaigns."
                    : "No revenue data is collected while this is off."}
                </span>
              </label>
              <Switch
                id="revenue-enabled"
                disabled={!admin}
                checked={value}
                onCheckedChange={setValue}
              />
            </section>
            {!admin && (
              <p className="text-xs text-muted-foreground">
                Only an admin can change these.
              </p>
            )}
          </div>

          {admin && (
            <div className="flex justify-end border-t border-sidebar-border px-5 py-3">
              <Button
                disabled={!dirty || saving}
                onClick={() => (value ? void save() : setConfirmOff(true))}
              >
                Save changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ActionConfirm
        open={confirmOff}
        setOpen={setConfirmOff}
        title="Turn off revenue tracking?"
        description="This stops collecting revenue data for this project in both Production and Test."
        confirmText="Turn off"
        onConfirm={() => void save()}
      />
    </>
  );
}
