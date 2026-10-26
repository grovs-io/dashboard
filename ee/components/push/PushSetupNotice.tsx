"use client";
import Link from "next/link";
import { BellRing, Check, ExternalLink } from "lucide-react";
import { PlatformIcon } from "@/components/analytics/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PUSH_PLATFORMS, TONE_CLASSES, type PushChannels } from "@ee/lib/push";
import type { PushPlatform } from "@ee/types/push";

const SETUP_HREFS: Record<PushPlatform, string> = {
  ios: "/settings/developers/ios_setup",
  android: "/settings/developers/android_setup",
};

function SetupButton({
  platform,
  configured,
  newTab,
}: {
  platform: (typeof PUSH_PLATFORMS)[number];
  configured: boolean;
  newTab?: boolean;
}) {
  const action = configured ? "Manage" : "Set up";
  return (
    <Button asChild size="sm" variant="outline" className="shrink-0">
      <Link
        href={SETUP_HREFS[platform.key]}
        aria-label={`${action} ${platform.label} push`}
        {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {action}
      </Link>
    </Button>
  );
}

export default function PushSetupNotice({
  channels,
  newTab,
  hideConsequence,
}: {
  channels: PushChannels | null | undefined;
  newTab?: boolean;
  hideConsequence?: boolean;
}) {
  if (!channels || (channels.ios && channels.android)) return null;

  if (channels.ios || channels.android) {
    const missing = PUSH_PLATFORMS.find((p) => !channels[p.key])!;
    return (
      <section
        role="note"
        aria-label={`${missing.label} push isn't configured`}
        className="rounded-xl border border-primary/30 overflow-hidden"
      >
        <div className="bg-gradient-to-r from-primary/8 to-primary/3 px-4 py-2.5 flex flex-col items-start gap-2 sm:min-h-12 sm:flex-row sm:items-center sm:gap-3">
          <p className="flex min-w-0 flex-1 items-start gap-2 text-sm leading-5">
            <PlatformIcon
              platform={missing.key}
              alt=""
              size={16}
              className="mt-0.5 shrink-0"
            />
            <span className="min-w-0">
              <span className="font-medium">
                {missing.label} push isn&apos;t configured
              </span>
              {!hideConsequence && (
                <span className="text-muted-foreground">
                  {" "}
                  — {missing.label} devices won&apos;t receive campaigns.
                </span>
              )}
            </span>
          </p>
          <SetupButton platform={missing} configured={false} newTab={newTab} />
        </div>
      </section>
    );
  }

  return (
    <section
      role="note"
      aria-label="Set up push notifications"
      className="max-w-[752px] rounded-xl border border-primary/30 overflow-hidden"
    >
      <div className="px-5 py-5 flex items-center gap-4 bg-gradient-to-r from-primary/8 to-primary/3">
        <div className="flex items-center justify-center h-11 w-11 rounded-xl shrink-0 bg-primary/15 ring-1 ring-primary/20">
          <BellRing className="h-5 w-5 text-primary" />
        </div>
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span className="text-lg font-semibold tracking-tight">
            Set up push notifications
          </span>
          <span className="text-xs text-muted-foreground">
            Campaigns reach devices through Apple (APNs) and Google (Firebase).
          </span>
        </div>
      </div>

      <div className="border-t border-sidebar-border">
        <div className="grid grid-cols-1 divide-y divide-sidebar-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {PUSH_PLATFORMS.map((p) => {
            const configured = channels[p.key];
            return (
              <div
                key={p.key}
                data-platform={p.key}
                className="px-5 py-4 flex items-center justify-between gap-3"
              >
                <div className="flex flex-col items-start gap-1.5 min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <PlatformIcon platform={p.key} alt="" size={16} />
                    {p.label}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "gap-1",
                      TONE_CLASSES[configured ? "green" : "grey"]
                    )}
                  >
                    {configured && <Check className="size-3" />}
                    {configured ? "Configured" : "Not configured"}
                  </Badge>
                </div>
                <SetupButton
                  platform={p}
                  configured={configured}
                  newTab={newTab}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
