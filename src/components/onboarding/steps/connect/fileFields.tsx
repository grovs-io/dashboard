"use client";

import { useRef, useState, type ReactNode } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { OkMark, PendingMark } from "../../primitives";

/** Dashed drop zone for a key file. */
export const DropFile = ({
  accept,
  placeholder,
  file,
  onFile,
}: {
  accept: string;
  placeholder: string;
  file: File | null;
  onFile: (file: File) => void;
}) => {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) onFile(dropped);
      }}
      className={cn(
        "flex h-16 w-full items-center justify-center gap-2 rounded-[9px] border-[1.5px] border-dashed border-chart-users/30 bg-background text-[13px] text-foreground/75",
        over && "border-chart-users bg-chart-users/[0.05]"
      )}
    >
      <Upload className="size-3.5 text-muted-foreground" />
      {file ? (
        <b className="font-medium text-foreground">{file.name}</b>
      ) : (
        <>
          Drop{" "}
          <span className="font-medium text-chart-users">{placeholder}</span> or
          click to upload
        </>
      )}
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        data-testid="drop-file-input"
        onChange={(e) => {
          const chosen = e.target.files?.[0];
          if (chosen) onFile(chosen);
        }}
      />
    </button>
  );
};

export const SaveStatus = ({
  saved,
  savedText,
  pendingText,
  action,
}: {
  saved: boolean;
  savedText: string;
  pendingText: string;
  action?: ReactNode;
}) => (
  <div className="mt-3 flex items-center gap-[9px] border-t border-chart-users/20 pt-3 text-[13px] text-muted-foreground">
    {saved ? <OkMark /> : <PendingMark />}
    {saved ? savedText : pendingText}
    {action && <span className="ml-auto">{action}</span>}
  </div>
);
