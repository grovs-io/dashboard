"use client";
import { BellRing } from "lucide-react";
import PlatformSetupPanel, {
  PhonePreview,
  type SetupPlatform,
} from "@/components/common/PlatformSetupPanel";

const PLATFORMS: readonly SetupPlatform[] = [
  {
    key: "ios",
    label: "iOS",
    needs: "APNs key (.p8) from your Apple Developer account",
    href: "/settings/developers/ios_setup",
  },
  {
    key: "android",
    label: "Android",
    needs: "Firebase project ID and service account (.json)",
    href: "/settings/developers/android_setup",
  },
];

// Shown on the list when neither platform has push set up: there is nothing to send through yet.
export default function PushOnboarding() {
  return (
    <PlatformSetupPanel
      title="Connect a platform to send push campaigns"
      description="Apple and Google deliver your campaigns using your app's own credentials. Connect one platform to start; you can add the other any time."
      platforms={PLATFORMS}
      noun="push"
      preview={
        <PhonePreview lockScreen>
          <div className="rounded-2xl border border-sidebar-border bg-muted/60 p-3 shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-3 motion-safe:duration-700">
            <div className="mb-1 flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-md bg-orange-100 dark:bg-orange-400/15">
                <BellRing className="size-3 text-orange-600 dark:text-orange-300" />
              </span>
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Your app
              </span>
              <span className="ml-auto text-[11px] text-muted-foreground">
                now
              </span>
            </div>
            <p className="text-[13px] font-semibold leading-snug">
              Your order is on its way
            </p>
            <p className="text-[13px] leading-snug text-muted-foreground">
              Arriving Thursday. Tap to track the delivery.
            </p>
          </div>
        </PhonePreview>
      }
    />
  );
}
