"use client";
import { useState } from "react";
import { Bell } from "lucide-react";
import { PlatformIcon } from "@/components/analytics/shared";
import { cn } from "@/lib/utils";

export type PreviewPlatform = "ios" | "android";

const PLATFORMS: { value: PreviewPlatform; label: string }[] = [
  { value: "ios", label: "iOS" },
  { value: "android", label: "Android" },
];

export function PreviewPlatformToggle({
  value,
  onChange,
}: {
  value: PreviewPlatform;
  onChange: (platform: PreviewPlatform) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Preview platform"
      className="inline-flex rounded-lg bg-muted p-0.5 dark:bg-background"
    >
      {PLATFORMS.map((p) => (
        <button
          key={p.value}
          type="button"
          aria-pressed={value === p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
            value === p.value
              ? "bg-background text-foreground shadow-sm ring-1 ring-sidebar-border dark:bg-muted"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <PlatformIcon platform={p.value} alt="" size={12} />
          {p.label}
        </button>
      ))}
    </div>
  );
}

interface Props {
  appName: string;
  title: string;
  body: string;
  image?: string | null;
  // Controlled when a parent shows the toggle itself (the report panel puts it in its header).
  platform?: PreviewPlatform;
}

export default function NotificationPreview({
  appName,
  title,
  body,
  image,
  platform: controlled,
}: Props) {
  const [own, setOwn] = useState<PreviewPlatform>("ios");
  const platform = controlled ?? own;
  const heading = title.trim() || "Notification title";
  const text = body.trim() || "Notification body";

  return (
    <div className="flex flex-col gap-3">
      {!controlled && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Preview
          </p>
          <PreviewPlatformToggle value={own} onChange={setOwn} />
        </div>
      )}

      <div
        data-testid="push-preview"
        data-platform={platform}
        className="rounded-xl bg-background p-3 shadow-sm ring-1 ring-sidebar-border dark:bg-muted"
      >
        <p
          aria-hidden
          className={cn(
            "mb-3 font-semibold tabular-nums text-muted-foreground/70",
            platform === "ios" ? "text-center text-2xl" : "text-xs"
          )}
        >
          9:41
        </p>
        {platform === "ios" ? (
          <div className="rounded-2xl bg-muted/70 p-3 dark:bg-background/60">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="flex size-4 items-center justify-center rounded bg-primary/15">
                <Bell className="size-2.5 text-primary" />
              </span>
              <span className="truncate uppercase tracking-wide">
                {appName}
              </span>
              <span className="ml-auto shrink-0">now</span>
            </div>
            <div className="mt-1.5 flex gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{heading}</p>
                <p className="line-clamp-4 whitespace-pre-wrap text-[13px] text-muted-foreground">
                  {text}
                </p>
              </div>
              {image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt=""
                  className="size-10 shrink-0 rounded-md object-cover"
                />
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-muted/70 p-3 dark:bg-background/60">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Bell className="size-3 text-primary" />
              <span className="truncate">{appName}</span>
              <span className="shrink-0">· now</span>
            </div>
            <p className="mt-1 truncate text-[13px] font-medium">{heading}</p>
            <p className="line-clamp-3 whitespace-pre-wrap text-[13px] text-muted-foreground">
              {text}
            </p>
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt=""
                className="mt-2 max-h-40 w-full rounded-md object-cover"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
