"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Globe } from "lucide-react";
import appleIcon from "@/assets/icons/generic/Apple.svg";
import appleIconDark from "@/assets/icons/generic/Apple_dark_mode.svg";
import androidIcon from "@/assets/icons/generic/Android.svg";
import androidIconDark from "@/assets/icons/generic/Android_dark_mode.svg";

export function PlatformIcon({
  platform,
  className,
  size = 14,
  alt,
}: {
  platform: string;
  className?: string;
  size?: number;
  /** Pass "" to make the icon decorative (e.g. when a text label follows it). */
  alt?: string;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const sizeClass = size <= 12 ? "w-3 h-3" : "w-3.5 h-3.5";

  const p = platform.toLowerCase();
  if (p === "ios") {
    return (
      <Image
        src={isDark ? appleIconDark : appleIcon}
        alt={alt ?? "iOS"}
        width={size}
        height={size}
        className={cn(sizeClass, className)}
      />
    );
  }
  if (p === "android") {
    return (
      <Image
        src={isDark ? androidIconDark : androidIcon}
        alt={alt ?? "Android"}
        width={size}
        height={size}
        className={cn(sizeClass, className)}
      />
    );
  }
  return <Globe className={cn(`h-3.5 w-3.5`, className)} />;
}

export function fmtNumber(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return k >= 10
      ? `${Math.round(k)}K`
      : `${k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return n.toLocaleString();
}
