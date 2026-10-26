"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  dashboardNameSchema,
  type DashboardNameValues,
} from "@/schemas/dashboard";

export function DashboardNameDialog({
  open,
  title,
  initialName = "",
  pending = false,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initialName?: string;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => Promise<void> | void;
}) {
  const form = useForm<DashboardNameValues>({
    resolver: zodResolver(dashboardNameSchema),
    defaultValues: { name: initialName },
    mode: "onChange",
  });
  useEffect(() => {
    if (open) form.reset({ name: initialName });
  }, [open, initialName, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Dashboards share the page&apos;s date range and filters.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(async (v) => {
            await onSubmit(v.name.trim());
          })}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Input
              aria-label="Dashboard name"
              placeholder="My dashboard"
              autoFocus
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !form.formState.isValid}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
