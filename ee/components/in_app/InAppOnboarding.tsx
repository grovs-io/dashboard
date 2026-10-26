"use client";
import { Truck, X } from "lucide-react";
import PlatformSetupPanel, {
  PhonePreview,
  type SetupPlatform,
} from "@/components/common/PlatformSetupPanel";

const PLATFORMS: readonly SetupPlatform[] = [
  {
    key: "ios",
    label: "iOS",
    needs: "Register the app and add the Grovs iOS SDK",
    href: "/settings/developers/ios_setup",
  },
  {
    key: "android",
    label: "Android",
    needs: "Register the app and add the Grovs Android SDK",
    href: "/settings/developers/android_setup",
  },
  {
    key: "web",
    label: "Web",
    needs: "Add your domain and the Grovs web SDK",
    href: "/settings/developers/web_setup",
  },
];

// Shown on the list when no platform has the SDK registered: no device could show a message yet.
export default function InAppOnboarding() {
  return (
    <PlatformSetupPanel
      title="Connect a platform to show in-app messages"
      description="Messages appear inside your app or site: when it opens, on a given screen, or after an event you track. Connect one platform to start."
      platforms={PLATFORMS}
      noun="in-app messages"
      preview={
        <PhonePreview>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Shop</span>
            <span className="size-6 rounded-full bg-muted" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="aspect-square rounded-lg bg-muted" />
                <div className="h-2 w-16 rounded bg-muted" />
                <div className="h-2 w-10 rounded bg-muted" />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full overflow-hidden rounded-2xl bg-background shadow-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500">
              <div className="relative flex h-24 items-center justify-center bg-gradient-to-br from-orange-100 to-amber-50 dark:from-orange-300/15 dark:to-amber-200/5">
                <Truck className="size-9 text-orange-400 dark:text-orange-300/80" />
                <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-black/10 dark:bg-white/10">
                  <X className="size-3 text-muted-foreground" />
                </span>
              </div>
              <div className="p-3.5">
                <p className="text-sm font-semibold">
                  Free shipping this weekend
                </p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  On every order over €30, until Sunday night.
                </p>
                <span className="mt-3 flex h-8 items-center justify-center rounded-md bg-orange-100 text-xs font-medium text-orange-800 dark:bg-orange-400/15 dark:text-orange-200">
                  Shop now
                </span>
                <span className="mt-1.5 block text-center text-[11px] text-muted-foreground">
                  Not now
                </span>
              </div>
            </div>
          </div>
        </PhonePreview>
      }
    />
  );
}
