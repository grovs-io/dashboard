"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useProjectSelection } from "@/context/useProjectSelection";
import { useCompleteSetupStepMutation } from "@/hooks/mutations/useInstanceMutations";
import { writeSearchParams } from "@/lib/searchParamsUrl";
import { Skeleton } from "@/components/ui/skeleton";
import { SetupTopBar } from "./SetupTopBar";
import {
  APP_CONNECTED_STEP,
  LINK_DOMAIN_STEP,
  ONBOARDING_CATEGORY,
  completedSteps,
  defaultPlatform,
  isPlatform,
  isSetupView,
  resumeView,
  type Platform,
  type SetupStepKey,
  type SetupView,
} from "./setupRules";
import { useSetupData } from "./useSetupData";
import { DomainStep } from "./steps/domain/DomainStep";
import { ConnectStep } from "./steps/connect/ConnectStep";
import { LinksStep } from "./steps/links/LinksStep";
import { SharePreviewStep } from "./steps/links/SharePreviewStep";
import { TryStep } from "./steps/TryStep";
import { DoneStep } from "./steps/DoneStep";

const LoadingPage = () => (
  <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_470px]">
    <div className="flex flex-col gap-4 px-4 py-10 sm:px-10 lg:pl-16">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-full max-w-[540px]" />
      <Skeleton className="mt-4 h-40 w-full max-w-[560px]" />
    </div>
    <div className="hidden border-l border-border bg-muted lg:block dark:bg-card" />
  </div>
);

/** Full-screen guided setup. Progress comes from saved data, so reopening resumes where it stopped. */
export const SetupFlow = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedInstance } = useProjectSelection();
  const stepParam = searchParams.get("step");
  const platformParam = searchParams.get("platform");
  const [view, setView] = useState<SetupView | null>(
    isSetupView(stepParam) ? stepParam : null
  );
  const [platform, setPlatform] = useState<Platform | null>(
    isPlatform(platformParam) ? platformParam : null
  );
  const [shareScreen, setShareScreen] = useState(false);
  const data = useSetupData(selectedInstance ?? null, view === "app");
  const complete = useCompleteSetupStepMutation(selectedInstance?.id);

  // Resume where the saved data says, once it has loaded.
  if (!data.loading && view === null) setView(resumeView(data.signals));
  if (!data.loading && platform === null)
    setPlatform(defaultPlatform(data.platforms));

  useEffect(() => {
    if (!view) return;
    writeSearchParams({
      step: view,
      platform: view === "app" ? platform : null,
    });
  }, [view, platform]);

  useEffect(() => {
    document.getElementById("setup-root")?.scrollTo?.(0, 0);
  }, [view, shareScreen]);

  const go = (next: SetupView, nextPlatform?: Platform) => {
    setShareScreen(false);
    if (nextPlatform) setPlatform(nextPlatform);
    setView(next);
  };

  // Leaves with the project and environment the rest of the app expects in the URL.
  const leave = (href: string) => {
    const params = new URLSearchParams(window.location.search);
    params.delete("step");
    params.delete("platform");
    const [path, query] = href.split("?");
    new URLSearchParams(query).forEach((v, k) => params.set(k, v));
    const qs = params.toString();
    router.push(qs ? `${path}?${qs}` : path!);
  };
  const close = () => leave("/dashboard");

  // Once seen, record it so the app step stays done when the SDK goes quiet.
  const appRecorded = useRef<string | null>(null);
  const instanceId = selectedInstance?.id ?? null;
  const { appConnected, appMarked } = data.signals;
  const { mutate: completeStep } = complete;
  useEffect(() => {
    if (data.loading || !appConnected || appMarked) return;
    if (!instanceId || appRecorded.current === instanceId) return;
    appRecorded.current = instanceId;
    completeStep({
      category: ONBOARDING_CATEGORY,
      stepIdentifier: APP_CONNECTED_STEP,
    });
  }, [data.loading, appConnected, appMarked, instanceId, completeStep]);

  const markDomain = () =>
    complete.mutate({
      category: ONBOARDING_CATEGORY,
      stepIdentifier: LINK_DOMAIN_STEP,
    });

  const instance = selectedInstance;
  const ready = !!instance && !data.loading && view !== null && platform;

  return (
    <div
      id="setup-root"
      className="fixed inset-0 z-40 flex flex-col bg-background text-foreground"
    >
      <SetupTopBar
        projectName={instance?.production?.name ?? instance?.name ?? ""}
        iconUrl={instance?.icon_url}
        view={view ?? "domain"}
        completed={completedSteps(data.signals)}
        onSelect={(step: SetupStepKey) => go(step)}
        onClose={close}
      />
      {!ready || !instance || !platform ? (
        <LoadingPage />
      ) : view === "domain" ? (
        <DomainStep
          key={instance.id}
          instance={instance}
          data={data}
          markDone={markDomain}
          onDone={() => go("app")}
        />
      ) : view === "app" ? (
        <ConnectStep
          key={instance.id}
          instance={instance}
          data={data}
          platform={platform}
          onPlatform={setPlatform}
          onBack={() => go("domain")}
          onNext={() => go("links")}
        />
      ) : view === "links" && !shareScreen ? (
        <LinksStep
          key={instance.id}
          instance={instance}
          data={data}
          onBack={() => go("app")}
          onNext={() => setShareScreen(true)}
          onConnect={(p) => go("app", p)}
        />
      ) : view === "links" ? (
        <SharePreviewStep
          key={instance.id}
          instance={instance}
          onBack={() => setShareScreen(false)}
          onNext={() => go("try")}
        />
      ) : view === "try" ? (
        <TryStep
          key={instance.id}
          instance={instance}
          onBack={() => {
            setView("links");
            setShareScreen(true);
          }}
          onFinish={() => go("done")}
        />
      ) : (
        <DoneStep
          key={instance.id}
          instance={instance}
          data={data}
          onEdit={(step, p) => go(step, p)}
          onNavigate={leave}
        />
      )}
    </div>
  );
};
