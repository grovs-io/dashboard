"use client";
import { useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { FieldError } from "@/components/common/FieldError";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// App-icon shaped drop zone: click or drop to upload; Replace/Remove sit beside it.
export default function AppIconField({
  url,
  accept,
  error,
  onFile,
}: {
  url: string | null;
  accept: string;
  error?: string;
  onFile: (file: File | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const choose = () => input.current?.click();
  return (
    <div className="flex items-start gap-4">
      <div
        data-testid="app-icon-tile"
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
        className={cn(
          "group relative size-[72px] shrink-0 overflow-hidden rounded-[22%] border transition-colors",
          over
            ? "border-primary bg-accent"
            : url
              ? "border-sidebar-border"
              : "border-dashed border-sidebar-border bg-muted/40",
          !!error && "border-destructive"
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={choose}
            aria-label="Upload icon"
            className="flex size-full items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <ImagePlus className="size-5" />
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept={accept}
          className="hidden"
          aria-label="Choose icon"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-[13px] font-medium">App icon</p>
        <p className="text-xs text-muted-foreground">
          Square image, at least 180×180 px. PNG, JPEG or WebP, up to 1 MB.
          Optional.
        </p>
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs"
            aria-label={url ? "Replace icon" : "Upload icon"}
            onClick={choose}
          >
            <Upload className="size-3.5" />
            {url ? "Replace" : "Upload"}
          </Button>
          {url && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-destructive"
              aria-label="Remove icon"
              onClick={() => onFile(null)}
            >
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          )}
        </div>
        <FieldError message={error} />
      </div>
    </div>
  );
}
