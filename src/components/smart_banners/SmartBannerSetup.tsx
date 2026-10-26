"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Loader2,
  Lock,
  PanelTop,
  RefreshCw,
  Smartphone,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RenderCodeBlock } from "@/components/developers/SetupShared";
import { useProjectSelection } from "@/context/useProjectSelection";
import { cn } from "@/lib/utils";
import {
  SMART_BANNER_CSS_SNIPPET,
  smartBannerSnippet,
} from "@/lib/smartBanners";
import type { SmartBannersStatus } from "@/types";
import { SAMPLE_BANNER, SmartBannerPreviewPanel } from "./SmartBannerPreview";

export const WEB_SETUP_PATH = "/settings/developers/web_setup";

const BENEFITS = [
  {
    icon: Smartphone,
    text: "Shown only to iPhone and Android visitors, in their mobile browser.",
  },
  {
    icon: Store,
    text: "Opens your app on the same content, or the store when it isn't installed.",
  },
  {
    icon: BarChart3,
    text: "Views, clicks and installs are counted for every banner.",
  },
];

type StepState = "current" | "next" | "locked";

function Step({
  n,
  state,
  title,
  subtitle,
  last,
  children,
}: {
  n: number;
  state: StepState;
  title: string;
  subtitle: string;
  last?: boolean;
  children?: ReactNode;
}) {
  return (
    <li
      aria-current={state === "current" ? "step" : undefined}
      data-state={state}
      className="relative flex gap-3 pb-6 last:pb-0"
    >
      {!last && (
        <span
          aria-hidden="true"
          className="absolute bottom-1 left-[13px] top-8 w-px bg-sidebar-border"
        />
      )}
      <span
        aria-hidden="true"
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          state === "current" && "bg-primary text-white",
          state === "next" && "border border-primary/40 text-primary",
          state === "locked" &&
            "border border-muted-foreground/30 text-muted-foreground"
        )}
      >
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3 pt-0.5">
        <div className="flex flex-col">
          <span
            className={cn(
              "flex items-center gap-1.5 text-sm font-semibold",
              state === "locked" && "text-muted-foreground"
            )}
          >
            {title}
            {state === "locked" && (
              <Lock
                className="size-3 text-muted-foreground/60"
                aria-label="Locked"
              />
            )}
          </span>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
        {children}
      </div>
    </li>
  );
}

function Frame({ children, phone }: { children: ReactNode; phone: ReactNode }) {
  return (
    <div className="grid overflow-hidden rounded-md border border-sidebar-border bg-sidebar lg:grid-cols-[minmax(0,1fr)_360px]">
      {children}
      <div className="hidden flex-col items-center justify-center border-l border-sidebar-border p-8 lg:flex">
        {phone}
      </div>
    </div>
  );
}

export function SmartBannerSetupSkeleton() {
  return (
    <Frame
      phone={
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-8 w-[118px] rounded-lg" />
          <Skeleton className="h-[532px] w-[252px] rounded-[40px]" />
          <Skeleton className="my-0.5 h-3 w-40" />
        </div>
      }
    >
      <div
        data-testid="smart-banner-setup-skeleton"
        aria-busy="true"
        className="flex flex-col gap-6 p-6 sm:p-8"
      >
        <Skeleton className="size-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-80 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="space-y-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-7 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

// Stands in for the banner list until a website domain is linked.
export default function SmartBannerSetup({
  status,
}: {
  status: SmartBannersStatus;
}) {
  const { selectedProject, selectedInstance } = useProjectSelection();
  const isTest =
    !!selectedProject && selectedProject.id === selectedInstance?.test?.id;
  const apiKey = selectedInstance?.api_key ?? "YOUR_API_KEY";

  return (
    <Frame
      phone={
        <SmartBannerPreviewPanel
          look={SAMPLE_BANNER}
          domain={status.domains[0]}
          caption="What visitors see on their phone"
        />
      }
    >
      <section
        aria-labelledby="smart-banner-setup-title"
        className="flex flex-col gap-6 p-6 sm:p-8"
      >
        <div className="flex flex-col items-start">
          <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-muted">
            <PanelTop className="size-5 text-muted-foreground" />
          </div>
          <h2
            id="smart-banner-setup-title"
            className="mb-2 text-sm font-semibold"
          >
            Turn mobile web visitors into app users
          </h2>
          <p className="max-w-lg text-xs leading-relaxed text-muted-foreground">
            A smart banner sits at the top or bottom of your mobile website and
            opens your app in one tap. Link your website first, then create
            banners here.
          </p>
        </div>

        <ul className="space-y-2">
          {BENEFITS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2.5 text-[13px]">
              <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                <Icon className="size-3" />
              </span>
              {text}
            </li>
          ))}
        </ul>

        <ol aria-label="Setup steps" className="flex flex-col">
          <Step
            n={1}
            state="current"
            title="Link your website domain"
            subtitle="Tell Grovs which site the banners run on."
          >
            <div>
              <Button asChild size="sm" className="pl-4 pr-3">
                <Link href={WEB_SETUP_PATH}>
                  Set up Web SDK
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </Step>
          <Step
            n={2}
            state="next"
            title="Install the Web SDK"
            subtitle="Add the Grovs script to every page of your site. Banners show once it runs."
          >
            <div className="flex flex-col gap-3">
              {isTest && (
                <p className="text-xs text-muted-foreground">
                  The snippet points at your test project.
                </p>
              )}
              <RenderCodeBlock
                data={[
                  {
                    language: "javascript",
                    filename: "app.js",
                    code: smartBannerSnippet(apiKey, isTest),
                  },
                  {
                    language: "css",
                    filename: "styles.css",
                    code: SMART_BANNER_CSS_SNIPPET,
                  },
                ]}
              />
            </div>
          </Step>
          <Step
            n={3}
            state="locked"
            title="Create your first banner"
            subtitle="Unlocks once your domain is linked."
            last
          />
        </ol>
      </section>
    </Frame>
  );
}

// Loading, error or setup: whatever stands in for banners until the website is connected.
export function SmartBannerSetupGate({
  query,
}: {
  query: UseQueryResult<SmartBannersStatus>;
}) {
  if (query.isError)
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-md border border-sidebar-border bg-muted/50 p-3 text-[13px]"
      >
        <span className="text-destructive">
          Could not check whether your website is connected.
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          {query.isFetching ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Retry
        </Button>
      </div>
    );
  if (!query.data) return <SmartBannerSetupSkeleton />;
  return <SmartBannerSetup status={query.data} />;
}
