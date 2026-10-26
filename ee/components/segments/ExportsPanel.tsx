"use client";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { showErrorNotification } from "@/lib/Notifications";
import { cn } from "@/lib/utils";
import { segmentsApi } from "@ee/api/segments/segmentsService";
import { useSegmentExportsQuery } from "@ee/hooks/queries/useSegmentsQueries";
import type { SegmentExport } from "@ee/types/segments";

interface Props {
  projectId: string;
  segmentId: string;
  definitionHash?: string;
  onExport?: () => void;
  exporting?: boolean;
}

const STATUS: Record<
  SegmentExport["status"],
  { label: string; className: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Preparing",
    className: "text-muted-foreground",
    icon: <Loader2 className="size-3.5 animate-spin" />,
  },
  ready: {
    label: "Ready",
    className: "text-foreground",
    icon: <CheckCircle2 className="size-3.5 text-muted-foreground" />,
  },
  failed: {
    label: "Failed",
    className: "text-destructive",
    icon: <AlertCircle className="size-3.5" />,
  },
  expired: {
    label: "Expired",
    className: "text-muted-foreground",
    icon: <Clock className="size-3.5" />,
  },
};

const ago = (iso: string) =>
  formatDistanceToNow(new Date(iso), { addSuffix: true });

export function ExportButton({
  onClick,
  busy,
  size = "sm",
}: {
  onClick?: () => void;
  busy?: boolean;
  size?: "sm" | "default";
}) {
  if (!onClick) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={onClick}
      disabled={busy}
    >
      <Download className="size-3.5" /> {busy ? "Starting…" : "Export CSV"}
    </Button>
  );
}

export default function ExportsPanel({
  projectId,
  segmentId,
  definitionHash,
  onExport,
  exporting,
}: Props) {
  const query = useSegmentExportsQuery(projectId);
  const [downloading, setDownloading] = useState<string | null>(null);
  const rows = (query.data ?? []).filter((e) => e.segment_id === segmentId);

  // The link is signed for five minutes and minted per request, so it is fetched on click, never stored.
  const download = async (exportId: string) => {
    setDownloading(exportId);
    try {
      const { data } = await segmentsApi.exportStatus(projectId, exportId);
      if (data.export.download_url)
        window.open(data.export.download_url, "_blank", "noopener");
      else showErrorNotification("This export has no file to download.");
    } catch {
      showErrorNotification("Could not fetch the download link.");
    } finally {
      setDownloading(null);
    }
  };

  if (query.isPending)
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-14 w-full rounded-md" />
        <Skeleton className="h-14 w-full rounded-md" />
      </div>
    );

  if (rows.length === 0)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
        <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <FileSpreadsheet className="size-5" />
        </span>
        <p className="text-sm font-medium">No exports yet</p>
        <p className="max-w-[240px] text-xs text-muted-foreground">
          Export the members as a CSV of identifiers and device ids. Files stay
          available for 24 hours.
        </p>
        <ExportButton onClick={onExport} busy={exporting} />
      </div>
    );

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((e) => {
        const status = STATUS[e.status];
        const stale =
          definitionHash !== undefined && e.definition_hash !== definitionHash;
        return (
          <li
            key={e.id}
            className="flex items-center gap-2.5 rounded-md border border-sidebar-border bg-background p-2.5"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <FileSpreadsheet className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[13px] font-medium">Members CSV</span>
              </div>
              <p className="text-xs leading-snug text-muted-foreground">
                {e.status === "pending" &&
                  `Requested ${ago(e.created_at)} · writing the file…`}
                {e.status === "ready" &&
                  `${(e.rows ?? 0).toLocaleString()} rows · ${ago(e.created_at)}${stale ? " · older definition" : ""}`}
                {e.status === "failed" &&
                  (e.error || "The export failed. Try again.")}
                {e.status === "expired" &&
                  `${(e.rows ?? 0).toLocaleString()} rows · ${ago(e.created_at)} · file removed`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs",
                  status.className
                )}
              >
                {status.icon} {status.label}
              </span>
              {e.status === "ready" && (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-8"
                  aria-label="Download"
                  title="Download CSV"
                  disabled={downloading === e.id}
                  onClick={() => void download(e.id)}
                >
                  {downloading === e.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                </Button>
              )}
              {e.status === "failed" && onExport && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={onExport}
                  disabled={exporting}
                >
                  Retry
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
