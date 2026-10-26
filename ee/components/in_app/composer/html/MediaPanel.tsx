"use client";
import {
  createContext,
  type DragEvent,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Copy,
  FileAudio,
  FileVideo,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { FieldError } from "@/components/common/FieldError";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/ApiError";
import { showErrorNotification } from "@/lib/Notifications";
import { handleCopyText } from "@/lib/copyTextHelper";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { inAppApi } from "@ee/api/in_app/inAppService";
import { inAppErrorText } from "@ee/lib/inApp";
import {
  MEDIA_ACCEPT,
  MEDIA_MAX_BYTES,
  MEDIA_MAX_FILES,
  mediaKind,
  mediaProblem,
  mediaUsed,
} from "@ee/lib/inAppHtml";
import type { InAppMedia } from "@ee/types/inApp";

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export const mediaName = (url: string) => {
  const last = url.split(/[?#]/)[0]!.split("/").pop() ?? url;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};

type Size = { width: number; height: number };

// Set by the design editor: puts a file into the HTML, with an image's own size once known.
export const MediaInsert = createContext<
  ((item: InAppMedia, size?: Size) => void) | null
>(null);

const badge = (name: string, type: string) => {
  const ext = /\.([a-z0-9]{2,4})$/i.exec(name)?.[1];
  return (ext ?? type.split("/")[1] ?? "file").toUpperCase();
};

function Tile({
  item,
  onDelete,
}: {
  item: InAppMedia;
  onDelete?: (item: InAppMedia) => void;
}) {
  const insert = useContext(MediaInsert);
  const size = useRef<Size | undefined>(undefined);
  const name = mediaName(item.url);
  const kind = mediaKind(item.type, name);
  const Icon = kind === "audio" ? FileAudio : FileVideo;
  return (
    <li
      aria-label={name}
      className="overflow-hidden rounded-lg border border-sidebar-border bg-background"
    >
      <div className="relative flex aspect-[4/3] items-center justify-center bg-muted">
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt=""
            className="size-full object-cover"
            onLoad={(e) => {
              const { naturalWidth: width, naturalHeight: height } =
                e.currentTarget;
              if (width && height) size.current = { width, height };
            }}
          />
        ) : kind === "video" ? (
          // The fragment makes the browser show the first frame instead of a black box.
          <video
            src={`${item.url}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            className="size-full object-cover"
          />
        ) : (
          <Icon className="size-8 text-muted-foreground" />
        )}
        <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-px text-[10px] font-semibold tracking-wide text-white">
          {badge(name, item.type)}
        </span>
      </div>
      <div className="space-y-1.5 p-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium" title={name}>
            {name}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {megabytes(item.bytes)}
          </p>
          <p
            className={cn(
              "text-[11px] font-medium",
              item.used ? "text-valid-green" : "text-muted-foreground"
            )}
          >
            {item.used ? "Used in this message" : "Not used yet"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {insert && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 flex-1 px-2 text-xs"
              aria-label={`Insert ${name}`}
              onClick={() =>
                insert(item, kind === "image" ? size.current : undefined)
              }
            >
              <Plus className="size-3.5" />
              Insert
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={`Copy the link of ${name}`}
            title="Copy link"
            onClick={() => handleCopyText(item.url)}
          >
            <Copy className="size-3.5" />
          </Button>
          {onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`Delete ${name}`}
              title="Delete"
              onClick={() => onDelete(item)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

// The files a custom HTML message can show or play, with what each costs of the caps.
export function MediaPanel({
  items,
  loading = false,
  loadError = null,
  onUpload,
  onDelete,
}: {
  items: InAppMedia[];
  loading?: boolean;
  loadError?: string | null;
  // Throws when the file can't go; an UploadRefused says why.
  onUpload: (file: File) => Promise<unknown>;
  // Without it files stay, as a journey keeps every upload.
  onDelete?: (item: InAppMedia) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const total = items.reduce((sum, m) => sum + m.bytes, 0);
  // Counted, as dragging over a child leaves the panel and enters the child.
  const [dragging, setDragging] = useState(0);
  // The name of the file on its way, if any.
  const [uploading, setUploading] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const error = failed ?? loadError;
  const current = useRef(items);
  useEffect(() => {
    current.current = items;
  });
  // Files dropped while one uploads wait their turn, in order.
  const chain = useRef<Promise<void>>(Promise.resolve());
  const upload = async (file: File) => {
    const problem = mediaProblem(file, current.current);
    setFailed(problem);
    if (problem) return;
    setUploading(file.name);
    try {
      await onUpload(file);
    } catch (e) {
      setFailed(uploadErrorText(e));
    } finally {
      setUploading(null);
    }
  };
  const take = (files: File[]) => {
    for (const file of files)
      chain.current = chain.current.then(() => upload(file));
  };
  const remove = async (item: InAppMedia) => {
    setFailed(null);
    try {
      await onDelete?.(item);
    } catch (e) {
      setFailed(uploadErrorText(e));
    }
  };
  const withFiles = (e: DragEvent) => e.dataTransfer.types.includes("Files");
  return (
    <div
      onDragEnter={(e) => withFiles(e) && setDragging((n) => n + 1)}
      onDragLeave={(e) =>
        withFiles(e) && setDragging((n) => Math.max(0, n - 1))
      }
      onDragOver={(e) => withFiles(e) && e.preventDefault()}
      onDrop={(e) => {
        if (!withFiles(e)) return;
        e.preventDefault();
        setDragging(0);
        take(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "relative min-h-full space-y-3 rounded-lg",
        dragging > 0 &&
          "outline-dashed outline-2 outline-offset-4 outline-primary"
      )}
    >
      {dragging > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/90 text-sm font-medium text-primary">
          Drop to upload
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium">Media</p>
          <p className="text-xs text-muted-foreground">
            {items.length} of {MEDIA_MAX_FILES} files, {megabytes(total)} of{" "}
            {MEDIA_MAX_BYTES / (1024 * 1024)} MB
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => input.current?.click()}
        >
          {uploading !== null ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          Upload
        </Button>
        <input
          ref={input}
          type="file"
          aria-label="Upload a file"
          accept={MEDIA_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            take(files);
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Drop files here. Images up to 1 MB, MP4 20 MB, MP3 or M4A 10 MB.
      </p>
      {uploading !== null && (
        <p className="text-xs text-muted-foreground">Uploading {uploading}…</p>
      )}
      <FieldError message={error ?? undefined} />
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading the files…</p>
      ) : items.length > 0 ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
          {items.map((item) => (
            <Tile
              key={item.id}
              item={item}
              onDelete={onDelete && ((item) => void remove(item))}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-sidebar-border p-4 text-center text-xs text-muted-foreground">
          No files yet. Drop pictures, videos or sounds here, or upload them.
        </p>
      )}
    </div>
  );
}

export const uploadErrorText = (error: unknown) =>
  error instanceof UploadRefused
    ? error.message
    : inAppErrorText(error, "Could not upload the file.");

const inUse = (error: unknown) =>
  error instanceof ApiError &&
  error.status === 409 &&
  inAppErrorText(error, "") === "in_use";

export const NOT_SAVED =
  "The message could not be saved, so the file was not uploaded. Fix what the save reports, then try again.";

export const WAIT =
  "Wait for the save or upload on its way to finish, then try again.";

// An upload or delete refused, or failed; its message is meant for the person.
export class UploadRefused extends Error {}

export const campaignMediaKey = (projectId: string, campaignId: string) => [
  ...queryKeys.projects.inAppCampaign(projectId, campaignId),
  "media",
];

// A campaign's media, as the server keeps it; "used" also counts what the draft holds but has not saved.
export function CampaignMedia({
  projectId,
  campaignId,
  htmls,
  upload,
  remove,
}: {
  projectId: string;
  campaignId: string | null;
  htmls: string[];
  // The composer's: they keep the campaign's version and the list current.
  upload: (file: File) => Promise<string>;
  remove: (item: InAppMedia) => Promise<void>;
}) {
  const list = useQuery({
    queryKey: campaignMediaKey(projectId, campaignId ?? ""),
    queryFn: async ({ signal }) =>
      (await inAppApi.media(projectId, campaignId!, signal)).data.media,
    enabled: !!campaignId,
  });
  return (
    <MediaPanel
      items={(list.data ?? []).map((m) => ({
        ...m,
        used: m.used || mediaUsed(htmls, m.url),
      }))}
      loading={list.isLoading}
      loadError={list.error ? "Could not load the files." : null}
      onUpload={upload}
      onDelete={async (item) => {
        if (mediaUsed(htmls, item.url))
          return void showErrorNotification(
            `${mediaName(item.url)} can\u2019t be deleted`,
            "It\u2019s still in the HTML. Take it out first."
          );
        try {
          await remove(item);
        } catch (e) {
          throw new UploadRefused(
            e instanceof UploadRefused
              ? e.message
              : inUse(e)
                ? `The last saved version still shows ${mediaName(item.url)}. Save the message, then delete it.`
                : inAppErrorText(e, "Could not delete the file.")
          );
        }
      }}
    />
  );
}
