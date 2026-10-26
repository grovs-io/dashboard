"use client";
import { useState } from "react";
import { Download, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { showErrorNotification } from "@/lib/Notifications";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { segmentsApi } from "@ee/api/segments/segmentsService";
import { useIdentifierListPreviewQuery } from "@ee/hooks/queries/useSegmentsQueries";

const ROW_WIDTHS = ["w-48", "w-40", "w-56", "w-36", "w-52", "w-44", "w-48"];

function ListSkeleton() {
  return (
    <div role="status" aria-label="Loading identifiers">
      <div className="h-64 divide-y divide-sidebar-border overflow-hidden">
        {ROW_WIDTHS.map((w, i) => (
          <div key={i} className="flex h-9 items-center px-3">
            <Skeleton className={`h-3.5 ${w}`} />
          </div>
        ))}
      </div>
      <div className="border-t border-sidebar-border px-3 py-2.5">
        <Skeleton className="h-3 w-64" />
      </div>
    </div>
  );
}

export default function IdentifierListPreview({
  projectId,
  segmentId,
  total,
}: {
  projectId: string;
  segmentId: string;
  total: number | null;
}) {
  const [term, setTerm] = useState("");
  const q = useDebouncedValue(term.trim(), 250);
  const preview = useIdentifierListPreviewQuery(projectId, segmentId, q);
  const [downloading, setDownloading] = useState(false);
  const searching = preview.isFetching && !preview.isPending;

  const download = async () => {
    setDownloading(true);
    try {
      const { data } = await segmentsApi.downloadIdentifierList(
        projectId,
        segmentId
      );
      const url = URL.createObjectURL(new Blob([data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `segment_${segmentId}_identifiers.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showErrorNotification("Couldn't download the list. Try again.");
    } finally {
      setDownloading(false);
    }
  };

  const ids = preview.data?.identifiers ?? [];
  const shownQ = preview.data?.q ?? q;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="px-9"
            placeholder="Search the uploaded identifiers"
            aria-label="Search identifiers"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setTerm("");
            }}
          />
          {searching ? (
            <Loader2
              aria-label="Searching"
              className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            />
          ) : (
            term && (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                onClick={() => setTerm("")}
              >
                <X className="size-3.5" />
              </button>
            )
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          className="ml-auto"
          disabled={downloading}
          onClick={() => void download()}
        >
          {downloading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Download CSV
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-sidebar-border">
        {preview.isPending ? (
          <ListSkeleton />
        ) : preview.isError ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Couldn&apos;t load the list. Download it instead.
          </p>
        ) : ids.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {shownQ ? (
              <>No identifiers match &quot;{shownQ}&quot;.</>
            ) : (
              "This list is empty. Upload a new one below."
            )}
          </p>
        ) : (
          <>
            <ul
              aria-label="Uploaded identifiers"
              className="max-h-64 divide-y divide-sidebar-border overflow-y-auto font-mono text-[13px]"
            >
              {ids.map((id) => (
                <li key={id} className="flex h-9 items-center truncate px-3">
                  {id}
                </li>
              ))}
            </ul>
            <p className="border-t border-sidebar-border px-3 py-2 text-xs text-muted-foreground">
              {preview.data?.more
                ? shownQ
                  ? "Showing the first 100 matches · refine the search or download the full list"
                  : `Showing the first 100 of ${total?.toLocaleString() ?? "many"} · search or download to see the rest`
                : `${ids.length.toLocaleString()} ${ids.length === 1 ? "identifier" : "identifiers"}${shownQ ? " match" : ""}`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
