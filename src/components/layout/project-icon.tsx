"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** The project's app icon from the App Store or Play, else the first letter of its name. */
export function ProjectIcon({
  url,
  name,
  className,
}: {
  url?: string | null;
  name?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const tile = cn(
    "relative flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-[22%] text-sm ring-1 ring-inset ring-black/5 dark:ring-white/10",
    className
  );

  if (url && failed !== url) {
    return (
      // Transparent artwork sits on a neutral tile, as on a home screen.
      <span className={cn(tile, "bg-muted")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          onError={() => setFailed(url)}
          className="size-full object-cover"
        />
      </span>
    );
  }

  const initial = Array.from(name?.trim() ?? "")[0]?.toUpperCase() ?? "–";
  return (
    <span
      data-testid="project-icon-fallback"
      className={cn(
        tile,
        "bg-background font-medium text-muted-foreground",
        className
      )}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
