"use client";

import { useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/apiErrorHelpers";
import {
  widgetKindLabel,
  type BuiltinDashboard,
  type BuiltinWidget,
} from "./builtinDashboards";
import { MAX_DASHBOARDS } from "./DashboardPicker";

export type CopyResult = { id: number; failed: string[] };

/** Copies a built-in into an editable board: a name and which widgets to keep. */
export function CopyDashboardDialog({
  dashboard,
  atLimit,
  onClose,
  onCreate,
  onOpenBoard,
}: {
  dashboard: BuiltinDashboard;
  atLimit: boolean;
  onClose: () => void;
  onCreate: (name: string, widgets: BuiltinWidget[]) => Promise<CopyResult>;
  onOpenBoard: (id: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(`${dashboard.name} — my version`);
  const [picked, setPicked] = useState(
    () => new Set(dashboard.widgets.map((w) => w.id))
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [partial, setPartial] = useState<CopyResult>();

  const total = dashboard.widgets.length;
  const allPicked = picked.size === total;
  const limitText = atLimit
    ? `You already have ${MAX_DASHBOARDS} boards, the limit. Delete one to copy this dashboard.`
    : undefined;
  const canCreate =
    !pending && !atLimit && name.trim().length > 0 && picked.size > 0;

  const toggle = (id: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function submit() {
    if (!canCreate) return;
    setPending(true);
    setError(undefined);
    try {
      const result = await onCreate(
        name.trim(),
        dashboard.widgets.filter((w) => picked.has(w.id))
      );
      if (result.failed.length) setPartial(result);
      else onOpenBoard(result.id);
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Couldn't create the board. Please try again.")
      );
    } finally {
      setPending(false);
    }
  }

  const message =
    limitText ??
    error ??
    (partial &&
      `Your board was created, but ${partial.failed.length === 1 ? "this widget" : "these widgets"} couldn't be added: ${partial.failed.join(", ")}.`);

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent
        className="gap-0 p-0 sm:max-w-[520px]"
        showCloseButton={!pending}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
          inputRef.current?.select();
        }}
        onInteractOutside={(e) => pending && e.preventDefault()}
        onEscapeKeyDown={(e) => pending && e.preventDefault()}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (partial) onOpenBoard(partial.id);
            else void submit();
          }}
        >
          <div className="flex flex-col gap-4 p-6 pb-5">
            <DialogHeader>
              <DialogTitle>Copy {dashboard.name} to your boards</DialogTitle>
              <DialogDescription>
                You&apos;ll get an editable board with the same widgets. The
                built-in {dashboard.name} dashboard stays as it is.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="copy-board-name">Board name</Label>
              <Input
                id="copy-board-name"
                ref={inputRef}
                value={name}
                maxLength={100}
                disabled={pending || !!partial}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="overflow-hidden rounded-lg border border-sidebar-border">
              <div className="flex items-center justify-between border-b border-sidebar-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <span>
                  Widgets to include · {picked.size} of {total}
                </span>
                <button
                  type="button"
                  disabled={pending || !!partial}
                  onClick={() =>
                    setPicked(
                      allPicked
                        ? new Set()
                        : new Set(dashboard.widgets.map((w) => w.id))
                    )
                  }
                  className="font-medium text-[var(--chart-users)] hover:text-[var(--chart-users-hover)] disabled:opacity-50"
                >
                  {allPicked ? "Clear all" : "Select all"}
                </button>
              </div>
              <ul className="max-h-[280px] divide-y divide-sidebar-border overflow-y-auto">
                {dashboard.widgets.map((w) => {
                  const id = `copy-widget-${w.id}`;
                  return (
                    <li key={w.id}>
                      <label
                        htmlFor={id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40"
                      >
                        <Checkbox
                          id={id}
                          checked={picked.has(w.id)}
                          disabled={pending || !!partial}
                          onCheckedChange={() => toggle(w.id)}
                        />
                        <span className="flex-1 truncate">{w.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {widgetKindLabel(w)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            {message && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
              >
                <AlertCircle className="mt-px size-3.5 shrink-0" />
                {message}
              </p>
            )}
          </div>

          <DialogFooter className="border-t border-sidebar-border bg-muted/40 px-6 py-4">
            {partial ? (
              <Button type="submit">Open board</Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!canCreate}>
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  {pending ? "Creating board…" : "Create board"}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
