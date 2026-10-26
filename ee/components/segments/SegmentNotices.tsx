"use client";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/ApiError";
import { backendMessage, segmentErrorMessage } from "@ee/lib/segments";

export const isClickhouseDown = (error: unknown) =>
  error instanceof ApiError && error.status === 503;

export function SegmentError({
  error,
  fallback,
  onRetry,
}: {
  error: unknown;
  fallback: string;
  onRetry?: () => void;
}) {
  const message =
    error instanceof ApiError
      ? segmentErrorMessage(error.code, backendMessage(error) || fallback)
      : fallback;
  const retryable =
    error instanceof ApiError &&
    (error.code === "segment_busy" || error.status === 503);
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
    >
      <span>{message}</span>
      {retryable && onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function IncompleteBadge() {
  return (
    <span
      className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
      title="A condition looks further back than your data retention; counts exclude deleted data."
    >
      incomplete
    </span>
  );
}
