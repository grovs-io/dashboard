"use client";
import { useRef, useState } from "react";
import { PanelTop, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSmartBannerQuery } from "@/hooks/queries/useSmartBannersQueries";
import { ApiError, getApiErrorInfo } from "@/lib/ApiError";
import { cn } from "@/lib/utils";
import SmartBannerComposer, { type CloseRef } from "./SmartBannerComposer";
import { SmartBannerStatusButton } from "./SmartBannerStatusPill";
import { RowMenu, type SmartBannerRowActions } from "./SmartBannersTable";

export const DIRTY_STATUS_HINT = "Save or discard your changes first";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  // null for a new banner.
  bannerId: number | null;
  domain?: string;
  // Status actions offered in the header when editing.
  actions?: SmartBannerRowActions;
}

function Loader({
  projectId,
  bannerId,
  domain,
  closeRef,
  onClose,
  onDirtyChange,
}: Omit<Props, "open" | "onOpenChange" | "actions"> & {
  closeRef: CloseRef;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { data, error, isFetchedAfterMount } = useSmartBannerQuery(
    projectId,
    bannerId ?? undefined
  );
  if (bannerId === null)
    return (
      <SmartBannerComposer
        domain={domain}
        closeRef={closeRef}
        onClose={onClose}
        onDirtyChange={onDirtyChange}
      />
    );
  if (error)
    return (
      <p role="alert" className="p-6 text-sm text-muted-foreground">
        {error instanceof ApiError && error.status === 404
          ? "Banner not found."
          : getApiErrorInfo(error).message}
      </p>
    );
  // The form seeds once, so wait for a fresh fetch rather than a cached copy.
  if (!data || !isFetchedAfterMount)
    return (
      <div className="flex-1 p-5">
        <Skeleton
          data-testid="smart-banner-editor-skeleton"
          className="h-full min-h-96 rounded-lg"
        />
      </div>
    );
  if (data.status === "archived")
    return (
      <p role="alert" className="p-6 text-sm text-muted-foreground">
        This banner is archived, so it cannot be edited. Restore it from the
        Archived view to edit it.
      </p>
    );
  // Keyed by id only: a refetch must not throw away what is being typed.
  return (
    <SmartBannerComposer
      key={data.id}
      banner={data}
      domain={domain}
      closeRef={closeRef}
      onClose={onClose}
      onDirtyChange={onDirtyChange}
    />
  );
}

// Hosted like the in-app message composer.
export default function SmartBannerDialog({
  open,
  onOpenChange,
  projectId,
  bannerId,
  domain,
  actions,
}: Props) {
  const closeRef = useRef<(() => void) | null>(null);
  // Unsaved composer changes lock the header's status actions until saved or discarded.
  const [dirty, setDirty] = useState(false);
  const close = () => onOpenChange(false);
  // Disabled once closed, so a later cache removal (e.g. delete) can't refetch a gone banner.
  const { data: banner } = useSmartBannerQuery(
    projectId,
    bannerId ?? undefined,
    open
  );
  // Deleting or archiving ends the edit, so the dialog closes before the confirm opens.
  const headerActions: SmartBannerRowActions | undefined = actions && {
    onOpen: () => {},
    onAction: (b, action) => {
      if (action === "delete" || action === "archive") close();
      actions.onAction(b, action);
    },
  };
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
          Set a smart banner&apos;s pages, content, style and behaviour
        </DialogDescription>
        <DialogHeader>
          <div className="flex w-full items-center gap-3 px-5 py-3.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-primary">
              <PanelTop className="size-4" />
            </span>
            <DialogTitle className="text-[15px] font-semibold">
              {bannerId === null ? "Create smart banner" : "Edit smart banner"}
            </DialogTitle>
            {banner && bannerId !== null && headerActions && (
              <div className="ml-auto">
                {dirty ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* A disabled trigger gets no pointer events, so the wrapper carries the tooltip. */}
                      <div
                        data-testid="smart-banner-status-disabled"
                        tabIndex={0}
                      >
                        <SmartBannerStatusButton banner={banner} disabled />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{DIRTY_STATUS_HINT}</TooltipContent>
                  </Tooltip>
                ) : (
                  <RowMenu
                    banner={banner}
                    actions={headerActions}
                    move={null}
                    disabled={false}
                    exclude={["edit"]}
                    trigger={<SmartBannerStatusButton banner={banner} />}
                  />
                )}
              </div>
            )}
            <button
              type="button"
              className={cn(
                "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                !(banner && bannerId !== null && headerActions) && "ml-auto"
              )}
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
            key={bannerId ?? "new"}
            projectId={projectId}
            bannerId={bannerId}
            domain={domain}
            closeRef={closeRef}
            onClose={close}
            onDirtyChange={setDirty}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
