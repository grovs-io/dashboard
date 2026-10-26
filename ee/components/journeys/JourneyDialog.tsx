"use client";
import { useRef } from "react";
import { Route, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useJourneyQuery } from "@ee/hooks/queries/useJourneyQueries";
import { journeyErrorText, type JourneyFocus } from "@ee/lib/journeys";
import JourneyEditor from "./editor/JourneyEditor";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  journeyId: string | null;
  // Just made from a template.
  fresh?: boolean;
  focus?: JourneyFocus;
}

// The dialog's own header while the journey is not on screen yet.
function Chrome({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <DialogHeader>
        <div className="flex w-full items-center gap-3 px-5 py-3.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-primary">
            <Route className="size-4" />
          </span>
          <DialogTitle className="text-[15px] font-semibold">
            {title}
          </DialogTitle>
          <button
            type="button"
            className="ml-auto flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        </div>
      </DialogHeader>
      <Separator />
      {children}
    </>
  );
}

function EditorSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading journey"
      className="flex min-h-0 flex-1"
    >
      <div className="flex flex-1 flex-col items-center gap-8 bg-sidebar py-6">
        <div className="flex gap-6">
          <Skeleton className="h-[86px] w-64 rounded-lg" />
          <Skeleton className="h-[86px] w-64 rounded-lg" />
        </div>
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-[74px] w-64 rounded-lg" />
        ))}
      </div>
      <div className="w-[360px] space-y-4 border-l border-sidebar-border p-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    </div>
  );
}

function Loader({
  projectId,
  journeyId,
  fresh,
  focus,
  closeRef,
  escapeRef,
  onClose,
}: Omit<Props, "open" | "onOpenChange" | "journeyId"> & {
  journeyId: string;
  closeRef: React.MutableRefObject<(() => void) | null>;
  escapeRef: React.MutableRefObject<(() => boolean) | null>;
  onClose: () => void;
}) {
  const query = useJourneyQuery(projectId, journeyId);
  const title = fresh ? "Create journey" : "Edit journey";
  if (query.data && query.data.status !== "ended")
    return (
      // Keyed by id only: a refetch must not throw away what is being edited.
      <JourneyEditor
        key={query.data.id}
        projectId={projectId}
        initial={query.data}
        fresh={fresh}
        focus={focus}
        closeRef={closeRef}
        escapeRef={escapeRef}
        onClose={onClose}
      />
    );
  return (
    <Chrome title={title} onClose={onClose}>
      {query.data ? (
        <p role="alert" className="p-6 text-sm text-muted-foreground">
          This journey has ended, so it cannot be edited. Duplicate it to run it
          again.
        </p>
      ) : query.isError ? (
        <p role="alert" className="p-6 text-sm text-muted-foreground">
          {journeyErrorText(query.error, "Could not load this journey.")}
        </p>
      ) : (
        <EditorSkeleton />
      )}
    </Chrome>
  );
}

// The journey editor, in the same full-width dialog as the other creators.
export default function JourneyDialog({
  open,
  onOpenChange,
  journeyId,
  ...rest
}: Props) {
  const closeRef = useRef<(() => void) | null>(null);
  const escapeRef = useRef<(() => boolean) | null>(null);
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
        onEscapeKeyDown={(e) => {
          if (escapeRef.current?.()) e.preventDefault();
        }}
        className="flex h-[92vh] w-full flex-col gap-0 overflow-hidden border-sidebar-border p-0 sm:max-w-[96vw] 2xl:max-w-[1560px]"
      >
        <DialogDescription className="sr-only">
          Build a journey: who enters, the steps they go through, and the goal
        </DialogDescription>
        {open && journeyId && (
          <Loader
            key={journeyId}
            {...rest}
            journeyId={journeyId}
            closeRef={closeRef}
            escapeRef={escapeRef}
            onClose={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
