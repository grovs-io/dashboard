"use client";
import { forwardRef, type ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  bannerDisplayStatus,
  type SmartBannerDisplayStatus,
} from "@/lib/smartBanners";
import { TONE_CLASSES, type StatusTone } from "@/lib/statusTone";
import { cn } from "@/lib/utils";
import type { SmartBanner } from "@/types";

const STATUS: Record<
  SmartBannerDisplayStatus,
  { label: string; tone: StatusTone; hint?: string }
> = {
  draft: { label: "Draft", tone: "grey" },
  live: { label: "Live", tone: "green" },
  paused: { label: "Paused", tone: "amber" },
  archived: { label: "Archived", tone: "muted" },
  not_live: {
    label: "Not live",
    tone: "red",
    hint: "This banner has no link and is not shown on your site",
  },
};

export default function SmartBannerStatusPill({
  banner,
}: {
  banner: Pick<SmartBanner, "status" | "default_link">;
}) {
  const s = STATUS[bannerDisplayStatus(banner)];
  return (
    <Badge variant="outline" className={TONE_CLASSES[s.tone]} title={s.hint}>
      {s.label}
    </Badge>
  );
}

// The pill as a button, for opening the row's actions.
export const SmartBannerStatusButton = forwardRef<
  HTMLButtonElement,
  ComponentProps<"button"> & {
    banner: Pick<SmartBanner, "name" | "status" | "default_link">;
  }
>(function SmartBannerStatusButton({ banner, className, ...props }, ref) {
  const s = STATUS[bannerDisplayStatus(banner)];
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`Status of ${banner.name}: ${s.label}`}
      className={cn("rounded-md disabled:cursor-wait", className)}
      {...props}
    >
      <span className="inline-flex items-center gap-0.5">
        <SmartBannerStatusPill banner={banner} />
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </span>
    </button>
  );
});
