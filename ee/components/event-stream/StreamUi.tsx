"use client";
import { useId, type ReactNode, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function StreamToolbar({
  target,
  children,
}: {
  target: HTMLElement | null;
  children: ReactNode;
}) {
  return target ? createPortal(children, target) : null;
}

export function StreamField({
  label,
  description,
  error,
  ...props
}: ComponentProps<typeof Input> & {
  label: string;
  description?: string;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error ? `${id}-error` : description ? `${id}-description` : undefined
        }
      />
      {description && (
        <p id={`${id}-description`} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
export function StreamSelect({
  label,
  options,
  ...props
}: ComponentProps<typeof Select> & {
  label: string;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select {...props}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function StreamSwitch({
  label,
  description,
  ...props
}: ComponentProps<typeof Switch> & { label: string; description: string }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <p
          id={`${id}-description`}
          className="text-xs leading-relaxed text-muted-foreground"
        >
          {description}
        </p>
      </div>
      <Switch id={id} aria-describedby={`${id}-description`} {...props} />
    </div>
  );
}
export function StreamCheck({
  children,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { children: ReactNode }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-1 size-4 shrink-0 accent-primary"
        {...props}
      />
      <span>{children}</span>
    </label>
  );
}
export function StreamError({ message }: { message?: string }) {
  return message ? (
    <p
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive break-words"
    >
      {message}
    </p>
  ) : null;
}
export function ConfirmAction({
  title,
  description,
  children,
  confirmLabel,
  pending,
  error,
  onConfirm,
  onClose,
  destructive = false,
  returnFocus,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  confirmLabel: string;
  pending: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
  destructive?: boolean;
  returnFocus: () => HTMLElement | null;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = returnFocus();
          if (target?.isConnected) target.focus();
        }}
        showCloseButton={!pending}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <StreamError message={error} />
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
