"use client";

import { Database, Download, KeyRound, Radio, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { config } from "@/lib/config";
import { IS_SELF_HOSTED } from "@/lib/edition";

const features = [
  {
    icon: Webhook,
    title: "Webhook destinations",
    description:
      "Send live events to your tools with signed webhook deliveries.",
  },
  {
    icon: Database,
    title: "S3-compatible storage",
    description: "Deliver compressed event files to your own storage bucket.",
  },
  {
    icon: KeyRound,
    title: "Pull feed tokens",
    description: "Read events at your own pace with secure, read-only tokens.",
  },
  {
    icon: Download,
    title: "Historical exports",
    description:
      "Export retained history to a destination or an emailed download.",
  },
];

export default function EventStreamAccess({
  onRetry,
  pending = false,
}: {
  onRetry?: () => void;
  pending?: boolean;
}) {
  return (
    <section aria-label="Event Stream access" className="-m-4 sm:-m-6">
      <div className="flex flex-col items-center bg-[image:var(--hero-gradient)] px-6 pb-10 pt-12 text-center sm:px-8">
        <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-foreground">
          <Radio className="size-5 text-background" aria-hidden="true" />
        </div>
        <h1 className="mb-2 text-xl font-semibold tracking-tight">
          Data Export
        </h1>
        <p className="mb-6 max-w-md text-sm leading-relaxed text-muted-foreground">
          {IS_SELF_HOSTED
            ? "Bring your app’s analytics and purchase events into the tools you already use."
            : "Send live events to your tools and export your history with Grovs Enterprise."}
        </p>
        {IS_SELF_HOSTED ? (
          <>
            <p className="mb-5 max-w-md text-sm leading-relaxed text-muted-foreground">
              Data Export isn’t available on this deployment. Ask your
              administrator to check Enterprise access.
            </p>
            {onRetry && (
              <Button
                size="lg"
                className="px-8"
                onClick={onRetry}
                disabled={pending}
              >
                {pending ? "Checking access…" : "Check access"}
              </Button>
            )}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="px-8">
              <a
                href={config.salesUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Contact sales
              </a>
            </Button>
            {onRetry && (
              <Button
                variant="link"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={onRetry}
                disabled={pending}
              >
                {pending ? "Checking access…" : "Refresh access"}
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:px-8">
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="flex items-start gap-3.5">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <feature.icon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-sm font-medium">{feature.title}</h2>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
