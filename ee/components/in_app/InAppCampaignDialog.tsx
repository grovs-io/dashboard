"use client";
import { useRef } from "react";
import { MessageSquareText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { inAppErrorText } from "@ee/lib/inApp";
import { useInAppCampaignQuery } from "@ee/hooks/queries/useInAppQueries";
import type { InAppDraft } from "@ee/lib/inAppComposer";
import InAppComposer, { type CloseRef } from "./composer/InAppComposer";
import { PreviewSkeleton } from "./composer/PreviewPanel";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  campaignId?: string | null;
  // A ready-made start, for a new message only.
  preset?: InAppDraft;
}

function Loader({
  projectId,
  campaignId,
  preset,
  closeRef,
  onClose,
}: Omit<Props, "open" | "onOpenChange"> & {
  closeRef: CloseRef;
  onClose: () => void;
}) {
  const query = useInAppCampaignQuery(
    projectId,
    campaignId ?? "",
    !!campaignId
  );
  if (!campaignId)
    return (
      <InAppComposer
        projectId={projectId}
        preset={preset}
        closeRef={closeRef}
        onClose={onClose}
      />
    );
  if (query.data)
    return query.data.status === "ended" ? (
      <p role="alert" className="p-6 text-sm text-muted-foreground">
        This campaign has ended, so it cannot be edited. Duplicate it to run it
        again.
      </p>
    ) : (
      // Keyed by id only: a refetch must not throw away what is being typed.
      <InAppComposer
        key={query.data.id}
        projectId={projectId}
        initial={query.data}
        closeRef={closeRef}
        onClose={onClose}
      />
    );
  if (query.isError)
    return (
      <p role="alert" className="p-6 text-sm text-muted-foreground">
        {inAppErrorText(query.error, "Could not load this campaign.")}
      </p>
    );
  return <ComposerSkeleton />;
}

// The composer while its campaign is on its way: steps, form and preview in their places.
function ComposerSkeleton() {
  const field = (label: string, control: string) => (
    <div className="flex flex-col gap-1.5">
      <Skeleton className={cn("my-[3px] h-3.5", label)} />
      <Skeleton className={cn("w-full", control)} />
    </div>
  );
  return (
    <div
      aria-busy="true"
      aria-label="Loading in-app message"
      className="flex min-h-0 flex-1 flex-col md:flex-row"
    >
      <div className="flex shrink-0 gap-1 border-b border-sidebar-border bg-sidebar p-3 md:w-[210px] md:flex-col md:gap-0.5 md:border-b-0 md:border-r">
        {["w-16", "w-14", "w-[70px]", "w-32", "w-28"].map((w) => (
          <div key={w} className="flex h-8 items-center gap-2.5 px-2.5">
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className={cn("h-3.5", w)} />
          </div>
        ))}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 space-y-5 overflow-hidden p-5">
            <div className="flex flex-col">
              <Skeleton className="my-1 h-3.5 w-20" />
              <Skeleton className="my-[3px] h-3.5 w-72 max-w-full" />
            </div>
            <div className="space-y-6">
              {field("w-16", "h-[82px] rounded-lg")}
              <div className="space-y-4">
                {field("w-8", "h-9")}
                {field("w-14", "h-16")}
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="my-[3px] h-3.5 w-24" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Skeleton className="h-[186px] rounded-lg" />
                  <Skeleton className="h-[186px] rounded-lg" />
                </div>
              </div>
              {field("w-32", "h-[62px] rounded-lg")}
            </div>
          </div>
          <div className="hidden w-[320px] shrink-0 border-l border-sidebar-border bg-sidebar p-5 lg:block">
            <PreviewSkeleton />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-sidebar-border px-5 py-3">
          <Skeleton className="h-9 w-[98px]" />
          <Skeleton className="h-9 w-[60px]" />
        </div>
      </div>
    </div>
  );
}

export default function InAppCampaignDialog({
  open,
  onOpenChange,
  projectId,
  campaignId,
  preset,
}: Props) {
  const closeRef = useRef<(() => void) | null>(null);
  const close = () => onOpenChange(false);
  const requestClose = () => (closeRef.current ?? close)();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex h-[90vh] max-h-[860px] w-full flex-col gap-0 overflow-hidden border-sidebar-border p-0 sm:max-w-[92vw] xl:max-w-[1180px]"
      >
        <DialogDescription className="sr-only">
          Compose an in-app message, choose what triggers it, who sees it and
          how often
        </DialogDescription>
        <DialogHeader>
          <div className="flex w-full items-center gap-3 px-5 py-3.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-primary">
              <MessageSquareText className="size-4" />
            </span>
            <DialogTitle className="text-[15px] font-semibold">
              {campaignId ? "Edit in-app message" : "Create in-app message"}
            </DialogTitle>
            <button
              type="button"
              className="ml-auto flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={requestClose}
              aria-label="Close dialog"
            >
              <X className="size-4" />
            </button>
          </div>
        </DialogHeader>
        <Separator />
        {open && (
          <Loader
            key={campaignId ?? `new-${preset?.name ?? ""}`}
            preset={preset}
            projectId={projectId}
            campaignId={campaignId}
            closeRef={closeRef}
            onClose={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
