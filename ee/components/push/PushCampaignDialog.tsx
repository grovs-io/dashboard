"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/ApiError";
import { pushErrorMessage } from "@ee/lib/push";
import { usePushCampaignQuery } from "@ee/hooks/queries/usePushQueries";
import type { PushCampaign } from "@ee/types/push";
import PushComposer, { type CloseRef } from "./composer/PushComposer";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  campaignId?: string | null;
}

function Notice({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 p-6">
      <p role="alert" className="text-sm text-muted-foreground">
        {children}
      </p>
      {action}
    </div>
  );
}

function Loader({
  projectId,
  campaignId,
  closeRef,
  onClose,
}: {
  projectId: string;
  campaignId?: string | null;
  closeRef: CloseRef;
  onClose: () => void;
}) {
  const router = useRouter();
  const query = usePushCampaignQuery(projectId, campaignId ?? "", !!campaignId);
  // Seeded once from settled data; a later refetch must not remount the composer.
  const [seed, setSeed] = useState<PushCampaign | null>(null);
  if (!seed && !query.isFetching && query.data?.status === "draft")
    setSeed(query.data);

  if (!campaignId)
    return (
      <PushComposer
        projectId={projectId}
        closeRef={closeRef}
        onClose={onClose}
      />
    );

  if (seed)
    return (
      <PushComposer
        key={seed.id}
        projectId={projectId}
        initial={seed}
        closeRef={closeRef}
        onClose={onClose}
      />
    );

  if (query.data && !query.isFetching)
    return (
      <Notice
        action={
          <Button
            variant="outline"
            onClick={() => {
              onClose();
              router.push(`/push/${campaignId}`);
            }}
          >
            Open report
          </Button>
        }
      >
        This campaign is no longer a draft, so it cannot be edited.
      </Notice>
    );

  if (query.isError && !query.isFetching) {
    const error = query.error;
    return (
      <Notice>
        {error instanceof ApiError && error.status === 404
          ? "This push campaign could not be found."
          : error instanceof ApiError
            ? pushErrorMessage(
                error.code,
                error.message || "Could not load this push campaign."
              )
            : "Could not load this push campaign."}
      </Notice>
    );
  }

  return (
    <div className="flex flex-1 gap-6 p-6">
      <Skeleton className="hidden h-full w-[220px] md:block" />
      <div className="flex flex-1 flex-col gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-9 w-2/3" />
      </div>
    </div>
  );
}

export default function PushCampaignDialog({
  open,
  onOpenChange,
  projectId,
  campaignId,
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
        className="flex h-[90vh] max-h-[860px] w-full flex-col gap-0 overflow-hidden border-sidebar-border p-0 sm:max-w-[90vw] xl:max-w-[1100px]"
      >
        <DialogDescription className="sr-only">
          Compose a push notification, choose its audience and when it goes out
        </DialogDescription>
        <DialogHeader>
          <div className="flex w-full items-center gap-3 px-5 py-3.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-primary">
              <BellRing className="h-4 w-4" />
            </span>
            <DialogTitle className="text-[15px] font-semibold">
              {campaignId ? "Edit push campaign" : "Create push campaign"}
            </DialogTitle>
            <button
              type="button"
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={requestClose}
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>
        <Separator />
        <Loader
          key={campaignId ?? "new"}
          projectId={projectId}
          campaignId={campaignId}
          closeRef={closeRef}
          onClose={close}
        />
      </DialogContent>
    </Dialog>
  );
}
