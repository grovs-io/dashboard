"use client";
import { useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Copy,
  EllipsisVertical,
  House,
  ImageIcon,
  Lock,
  Menu,
  Plus,
  RotateCw,
  Share,
  ShoppingBag,
  SlidersHorizontal,
} from "lucide-react";
import DeviceFrame, { SAFE_AREAS } from "@/components/composer/DeviceFrame";
import Segmented from "@/components/composer/Segmented";
import { cn } from "@/lib/utils";
import type { SmartBannerPlatform, SmartBannerPosition } from "@/types";

export interface SmartBannerLook {
  position: SmartBannerPosition;
  title: string;
  subtitle: string;
  buttonText: string;
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
  iconUrl: string | null;
}

// Sizes copied from the grovs-js banner CSS; keep in sync.
export function SmartBannerBar(p: SmartBannerLook) {
  return (
    <div
      data-testid="smart-banner-preview"
      data-position={p.position}
      className="box-border flex w-full items-center gap-[10px] px-3 py-[10px] text-[14px] leading-[1.3] [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]"
      style={{ backgroundColor: p.backgroundColor, color: p.textColor }}
    >
      <span
        aria-hidden="true"
        className="p-1 text-[20px] leading-none opacity-60"
      >
        ×
      </span>
      {p.iconUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.iconUrl}
          alt="App icon"
          className="size-10 flex-none rounded-[9px] object-cover"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{p.title}</span>
        {p.subtitle && (
          <span className="truncate text-[12px] opacity-80">{p.subtitle}</span>
        )}
      </div>
      <span
        className="flex-none rounded-full px-[14px] py-[7px] font-semibold"
        style={{ backgroundColor: p.buttonColor, color: p.buttonTextColor }}
      >
        {p.buttonText}
      </span>
    </div>
  );
}

const BROWSERS: Record<SmartBannerPlatform, string> = {
  ios: "iPhone, Safari",
  android: "Android, Chrome",
};

// The address bar shows the host only; a file:// origin (e.g. Electron) reads as "Local file".
const addressBarLabel = (domain: string) =>
  domain.startsWith("file://")
    ? "Local file"
    : domain.replace(/^https?:\/\//, "");

const PLATFORM_OPTIONS = [
  { value: "ios" as const, label: "iOS" },
  { value: "android" as const, label: "Android" },
];

// Safari on iOS: address field and toolbar at the bottom.
function SafariBar({ domain }: { domain: string }) {
  return (
    <div
      data-testid="browser-chrome"
      data-browser="safari"
      className="flex-none border-t border-black/10 bg-[#F6F6F6]/95 px-4 pt-2"
    >
      <div className="flex h-11 items-center gap-2 rounded-xl bg-white px-3 shadow-[0_1px_3px_rgba(0,0,0,0.10)]">
        <span className="text-[15px] font-medium text-black">
          <span className="text-[11px]">A</span>A
        </span>
        <span className="flex min-w-0 flex-1 items-center justify-center gap-1 text-[17px] text-black">
          <Lock className="size-3.5 flex-none text-[#3C3C43]/70" />
          <span className="truncate">{domain}</span>
        </span>
        <RotateCw className="size-4 text-black" />
      </div>
      <div className="flex h-11 items-center justify-between px-3 text-[#007AFF]">
        <ChevronLeft className="size-7" strokeWidth={2} />
        <ChevronRight className="size-7 opacity-30" strokeWidth={2} />
        <Share className="size-6" strokeWidth={1.75} />
        <BookOpen className="size-6" strokeWidth={1.75} />
        <Copy className="size-6" strokeWidth={1.75} />
      </div>
    </div>
  );
}

// Chrome on Android: omnibox at the top.
function ChromeBar({ domain }: { domain: string }) {
  return (
    <div
      data-testid="browser-chrome"
      data-browser="chrome"
      className="flex h-14 flex-none items-center gap-1 border-b border-black/[0.06] bg-white px-2 text-[#444746]"
    >
      <House className="m-2 size-6 flex-none" strokeWidth={1.75} />
      <span className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-[#F0F3F8] px-3.5 text-[16px] text-[#1F1F1F]">
        <SlidersHorizontal className="size-4 flex-none" strokeWidth={2} />
        <span className="truncate">{domain}</span>
      </span>
      <Plus className="m-2 size-6 flex-none" strokeWidth={1.75} />
      <span className="m-2 flex size-[21px] flex-none items-center justify-center rounded-[5px] border-2 border-current text-[11px] font-bold">
        2
      </span>
      <EllipsisVertical className="mr-1 size-6 flex-none" strokeWidth={2} />
    </div>
  );
}

const Line = ({ w, className }: { w: string; className?: string }) => (
  <span
    className={cn("block h-2.5 rounded-full bg-[#E6E9EE]", className)}
    style={{ width: w }}
  />
);

// A generic shop page behind the banner, in muted skeleton tones.
function SamplePage() {
  return (
    <div aria-hidden="true" className="absolute inset-0 bg-white">
      <div className="flex h-14 items-center justify-between border-b border-[#F0F1F4] px-5">
        <span className="flex items-center gap-2">
          <span className="size-7 rounded-lg bg-[#1F2937]" />
          <span className="h-3 w-20 rounded-full bg-[#9AA3B2]" />
        </span>
        <span className="flex items-center gap-4 text-[#9AA3B2]">
          <ShoppingBag className="size-5" strokeWidth={1.75} />
          <Menu className="size-5" strokeWidth={1.75} />
        </span>
      </div>
      <div className="relative mx-4 mt-4 flex h-[190px] items-center justify-center overflow-hidden rounded-[20px] bg-gradient-to-br from-[#EEF1F6] to-[#DCE3EC]">
        <ImageIcon className="size-12 text-[#C2CBD8]" strokeWidth={1.25} />
        <span className="absolute bottom-4 left-4 h-8 w-24 rounded-full bg-white/80" />
      </div>
      <div className="space-y-2.5 px-5 pt-5">
        <span className="block h-4 w-3/5 rounded-full bg-[#D5DBE3]" />
        <Line w="88%" />
        <Line w="70%" />
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 pt-5">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-[#EEF0F3] p-2.5 pb-3"
          >
            <span className="block aspect-square rounded-xl bg-[#F1F3F7]" />
            <Line w="80%" className="mt-3" />
            <span className="mt-2 block h-3 w-12 rounded-full bg-[#C9D1DC]" />
          </div>
        ))}
      </div>
      <div className="space-y-2.5 px-5 pt-5">
        <Line w="92%" />
        <Line w="76%" />
        <Line w="84%" />
      </div>
    </div>
  );
}

// A phone at real scale, in its own browser, with the banner where the Web SDK puts it.
export function SmartBannerPhone({
  platform,
  domain = "yourshop.com",
  maxWidth = 270,
  maxHeight = 520,
  ...look
}: SmartBannerLook & {
  platform: SmartBannerPlatform;
  domain?: string;
  maxWidth?: number;
  maxHeight?: number;
}) {
  const ios = platform === "ios";
  const safe = SAFE_AREAS[platform];
  const top = look.position === "top";
  const shownDomain = addressBarLabel(domain);
  return (
    <div
      data-testid="smart-banner-phone"
      data-platform={platform}
      data-position={look.position}
    >
      <DeviceFrame
        device="phone"
        platform={platform}
        maxWidth={maxWidth}
        maxHeight={maxHeight}
        label={`Smart banner preview, ${BROWSERS[platform]}`}
      >
        <div className="absolute inset-0 flex flex-col bg-white [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
          <div className="flex-none bg-white" style={{ height: safe.top }} />
          {!ios && <ChromeBar domain={shownDomain} />}
          {top && (
            <div className="relative z-10 flex-none border-b border-black/[0.08]">
              <SmartBannerBar {...look} />
            </div>
          )}
          <div
            data-testid="smart-banner-page"
            className="relative min-h-0 flex-1 overflow-hidden"
          >
            <SamplePage />
            {!top && (
              <div className="absolute inset-x-0 bottom-0 z-10 shadow-[0_-4px_16px_rgba(15,23,42,0.12)]">
                <SmartBannerBar {...look} />
              </div>
            )}
          </div>
          {ios && <SafariBar domain={shownDomain} />}
          <div
            className={cn("flex-none", ios ? "bg-[#F6F6F6]" : "bg-white")}
            style={{ height: safe.bottom }}
          />
        </div>
      </DeviceFrame>
    </div>
  );
}

// Banner preview with the iOS / Android switch, shared by the setup screen and the composer.
export function SmartBannerPreviewPanel({
  look,
  platforms = ["ios", "android"],
  domain,
  caption,
}: {
  look: SmartBannerLook;
  // Platforms the banner targets; the others can't be previewed.
  platforms?: SmartBannerPlatform[];
  domain?: string;
  caption?: string;
}) {
  const [chosen, setPlatform] = useState<SmartBannerPlatform>(
    platforms[0] ?? "ios"
  );
  const platform: SmartBannerPlatform = platforms.includes(chosen)
    ? chosen
    : (platforms[0] ?? chosen);
  return (
    <div className="flex flex-col items-center gap-4">
      <Segmented
        label="Preview on"
        value={platform}
        onChange={setPlatform}
        options={PLATFORM_OPTIONS.map((o) => {
          const off = platforms.length > 0 && !platforms.includes(o.value);
          return {
            ...o,
            disabled: off,
            title: off ? `This banner doesn't target ${o.label}` : undefined,
          };
        })}
      />
      <SmartBannerPhone platform={platform} domain={domain} {...look} />
      <p className="text-center text-xs text-muted-foreground">
        {caption ?? `${BROWSERS[platform]}. Shown only in mobile browsers.`}
      </p>
    </div>
  );
}

export const SAMPLE_BANNER: SmartBannerLook = {
  position: "top",
  title: "Get the app",
  subtitle: "Faster checkout in our app",
  buttonText: "Open",
  backgroundColor: "#FFFFFF",
  textColor: "#111827",
  buttonColor: "#2A86FF",
  buttonTextColor: "#FFFFFF",
  iconUrl: null,
};
