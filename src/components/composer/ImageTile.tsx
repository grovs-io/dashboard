"use client";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// A drop zone for one image: choose, drop, replace or remove it.
export default function ImageTile({
  name,
  title,
  hint,
  url,
  busy = false,
  accept,
  formats,
  onFile,
  className,
}: {
  // What the image is, for the button labels: "Choose {name}", "Remove {name}".
  name: string;
  title: string;
  hint?: string;
  url: string | null;
  busy?: boolean;
  accept: string;
  formats: string;
  onFile: (file: File | null) => void;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const take = (file: File | undefined) => file && onFile(file);
  return (
    <div className="min-w-0 space-y-1.5">
      <div>
        <p className="text-[13px] font-medium">{title}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files[0]);
        }}
        className={cn(
          "group relative flex h-36 items-center justify-center overflow-hidden rounded-lg border border-dashed transition-colors",
          over
            ? "border-primary bg-accent"
            : "border-sidebar-border bg-muted/40",
          className
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="size-full object-contain" />
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ImagePlus className="size-5" />
            <span className="text-xs font-medium">
              Drop an image or choose one
            </span>
            <span className="text-[11px]">{formats}</span>
          </button>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
        {url && !busy && (
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1.5 bg-gradient-to-t from-black/50 to-transparent p-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7"
              onClick={() => input.current?.click()}
            >
              Replace
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="size-7"
              aria-label={`Remove ${name}`}
              onClick={() => onFile(null)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept={accept}
          className="hidden"
          aria-label={`Choose ${name}`}
          onChange={(e) => {
            take(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
