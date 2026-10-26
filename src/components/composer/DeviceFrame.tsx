"use client";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const PREVIEW_DEVICES = ["phone", "landscape", "web"] as const;
export type PreviewDevice = (typeof PREVIEW_DEVICES)[number];

// The screen each device draws on, in its own points, as the SDKs see it.
export const SCREENS: Record<PreviewDevice, { width: number; height: number }> =
  {
    phone: { width: 390, height: 844 },
    landscape: { width: 844, height: 390 },
    web: { width: 1280, height: 800 },
  };

// iPhone landscape safe area: the island side, mirrored on the other, and the home indicator.
export const LANDSCAPE_SAFE = { side: 59, bottom: 21 };

// The Dynamic Island on the left edge of a phone on its side.
export function LandscapeIsland() {
  return (
    <span
      aria-hidden="true"
      data-testid="landscape-island"
      className="pointer-events-none absolute left-[11px] top-1/2 z-20 h-[126px] w-[37px] -translate-y-1/2 rounded-full bg-black"
    />
  );
}

export function previewScale(
  device: PreviewDevice,
  maxWidth: number,
  maxHeight: number
): number {
  const screen = SCREENS[device];
  return Math.min(maxWidth / screen.width, maxHeight / screen.height);
}

// A placeholder page for whatever is previewed on top of it.
export function PreviewPage({
  device,
  className,
}: {
  device: PreviewDevice;
  className?: string;
}) {
  const web = device === "web";
  return (
    <div
      aria-hidden="true"
      className={cn("absolute inset-0 bg-[#F3F5F8]", className)}
    >
      {web && (
        <div className="flex h-[52px] items-center gap-2 border-b border-[#D5DBE3] bg-white px-5">
          <span className="size-3 rounded-full bg-[#D5DBE3]" />
          <span className="size-3 rounded-full bg-[#D5DBE3]" />
          <span className="size-3 rounded-full bg-[#D5DBE3]" />
          <span className="ml-4 h-7 flex-1 rounded-full bg-[#EEF1F5]" />
        </div>
      )}
      <div
        className={cn(
          "grid gap-5 p-6 opacity-70",
          web
            ? "grid-cols-3 pt-8"
            : device === "landscape"
              ? "grid-cols-2"
              : "pt-16"
        )}
      >
        <div className="col-span-full h-7 w-1/3 rounded-md bg-[#D5DBE3]" />
        {Array.from({ length: web ? 6 : 4 }, (_, i) => (
          <div key={i} className="h-36 rounded-2xl bg-[#E2E7EE]" />
        ))}
      </div>
    </div>
  );
}

export type PhonePlatform = "ios" | "android";

// Status bar and home-indicator heights, in the phone's points.
export const SAFE_AREAS: Record<
  PhonePlatform,
  { top: number; bottom: number }
> = {
  ios: { top: 54, bottom: 34 },
  android: { top: 36, bottom: 20 },
};

const SCREEN_RADIUS: Record<PhonePlatform, number> = { ios: 55, android: 40 };
const BEZEL = 6;

function StatusIcons({ platform }: { platform: PhonePlatform }) {
  if (platform === "android")
    return (
      <svg width="62" height="14" viewBox="0 0 62 14" fill="#1F1F1F">
        <path d="M8 13 0 4.6A11.4 11.4 0 0 1 16 4.6Z" />
        <path d="M34 1v12H22Z" />
        <rect x="46" y="1" width="8" height="12.5" rx="1.6" />
        <rect x="48.5" y="0" width="3" height="1.6" rx=".6" />
      </svg>
    );
  return (
    <svg width="76" height="13" viewBox="0 0 76 13" fill="#000">
      <rect x="0" y="8" width="3.2" height="4.5" rx="1" />
      <rect x="4.8" y="5.8" width="3.2" height="6.7" rx="1" />
      <rect x="9.6" y="3.4" width="3.2" height="9.1" rx="1" />
      <rect x="14.4" y="1" width="3.2" height="11.5" rx="1" />
      <path d="M31 3.2a10.6 10.6 0 0 1 7.6 3.1l1.3-1.3a12.5 12.5 0 0 0-17.8 0l1.3 1.3A10.6 10.6 0 0 1 31 3.2Zm0 3.7a6.9 6.9 0 0 1 4.9 2.1l1.3-1.3a8.8 8.8 0 0 0-12.4 0L26.1 9A6.9 6.9 0 0 1 31 6.9Zm0 3.7c.9 0 1.6.4 2.2.9L31 13.7l-2.2-2.2c.6-.5 1.3-.9 2.2-.9Z" />
      <rect
        x="47.5"
        y=".5"
        width="24"
        height="12"
        rx="3.8"
        fill="none"
        stroke="#000"
        strokeOpacity=".4"
      />
      <rect x="49.5" y="2.5" width="20" height="8" rx="2.2" />
      <path
        d="M73 4.4v4.2c.8-.3 1.4-1.1 1.4-2.1S73.8 4.7 73 4.4Z"
        fillOpacity=".45"
      />
    </svg>
  );
}

// The phone's own hardware and system bars, drawn over the screen's content.
function PhoneChrome({ platform }: { platform: PhonePlatform }) {
  const ios = platform === "ios";
  const safe = SAFE_AREAS[platform];
  return (
    <div
      aria-hidden="true"
      data-testid="phone-chrome"
      className="pointer-events-none absolute inset-0 z-20 [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]"
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 flex items-center justify-between",
          ios ? "px-[34px] pt-1" : "px-6"
        )}
        style={{ height: safe.top }}
      >
        <span
          className={cn(
            "tabular-nums",
            ios
              ? "w-[78px] text-center text-[17px] font-semibold text-black"
              : "text-[14px] font-medium text-[#1F1F1F]"
          )}
        >
          9:41
        </span>
        <StatusIcons platform={platform} />
      </div>
      {ios ? (
        <span
          data-testid="dynamic-island"
          className="absolute left-1/2 top-[11px] h-[37px] w-[126px] -translate-x-1/2 rounded-full bg-black"
        />
      ) : (
        <span
          data-testid="punch-hole"
          className="absolute left-1/2 top-[9px] size-[19px] -translate-x-1/2 rounded-full bg-black ring-[3px] ring-black/10"
        />
      )}
      <span
        className={cn(
          "absolute left-1/2 -translate-x-1/2 rounded-full",
          ios
            ? "bottom-2 h-[5px] w-[134px] bg-black"
            : "bottom-[7px] h-1 w-[108px] bg-[#1F1F1F]/80"
        )}
      />
    </div>
  );
}

// Drawn at the device's real size and then scaled, so proportions are the ones people will see.
export default function DeviceFrame({
  device = "phone",
  platform,
  maxWidth,
  maxHeight,
  label,
  testId,
  children,
}: {
  device?: PreviewDevice;
  // A specific phone, with its camera cut-out and system bars.
  platform?: PhonePlatform;
  maxWidth: number;
  maxHeight: number;
  label: string;
  testId?: string;
  // Laid out on the device's own screen, in its points.
  children: ReactNode;
}) {
  const screen = SCREENS[device];
  const scale = previewScale(device, maxWidth, maxHeight);
  if (platform && device === "phone") {
    const radius = SCREEN_RADIUS[platform] * scale;
    const width = screen.width * scale;
    const height = screen.height * scale;
    return (
      <div
        className="relative mx-auto"
        style={{ width: width + BEZEL * 2, height: height + BEZEL * 2 }}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute w-[3px] rounded-r-sm bg-[#2A2F38]",
            platform === "ios"
              ? "-right-[2px] top-[28%] h-[13%]"
              : "-right-[2px] top-[22%] h-[9%]"
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute w-[3px] bg-[#2A2F38]",
            platform === "ios"
              ? "-left-[2px] top-[22%] h-[9%] rounded-l-sm"
              : "-right-[2px] top-[34%] h-[15%] rounded-r-sm"
          )}
        />
        <div
          aria-label={label}
          role="img"
          data-device={device}
          data-platform={platform}
          data-testid={testId}
          className="relative size-full bg-[#1B1F27] shadow-[0_24px_48px_-24px_rgba(15,23,42,0.45),inset_0_0_0_1px_rgba(255,255,255,0.10)] ring-1 ring-black/10 dark:ring-white/15"
          style={{ borderRadius: radius + BEZEL, padding: BEZEL }}
        >
          <div
            className="relative overflow-hidden bg-white"
            style={{ width, height, borderRadius: radius }}
          >
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{
                width: screen.width,
                height: screen.height,
                transform: `scale(${scale})`,
              }}
            >
              {children}
              <PhoneChrome platform={platform} />
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      aria-label={label}
      role="img"
      data-device={device}
      data-testid={testId}
      className={cn(
        "relative mx-auto overflow-hidden bg-[#1B1F27]",
        device === "web"
          ? "rounded-lg border border-[#C9D0D9]"
          : "rounded-[22px] p-[5px]"
      )}
      style={{
        width: screen.width * scale + (device === "web" ? 2 : 10),
        height: screen.height * scale + (device === "web" ? 2 : 10),
      }}
    >
      <div
        className={cn(
          "relative overflow-hidden",
          device === "web" ? "rounded-[7px]" : "rounded-[17px]"
        )}
        style={{ width: screen.width * scale, height: screen.height * scale }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: screen.width,
            height: screen.height,
            transform: `scale(${scale})`,
          }}
        >
          {children}
          {device === "landscape" && <LandscapeIsland />}
        </div>
      </div>
    </div>
  );
}
