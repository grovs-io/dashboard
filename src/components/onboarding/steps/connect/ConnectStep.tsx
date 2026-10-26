"use client";

import { useRef, useState, type ReactNode } from "react";
import { Check, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlatformIcon } from "@/components/analytics/shared";
import type { Instance } from "@/types";
import {
  DocLink,
  FooterSpacer,
  HelpDocs,
  HelpLinks,
  HelpPitfalls,
  HelpTitle,
  Lead,
  PrimaryButton,
  QuietButton,
  Segmented,
  Spinner,
  StepPage,
  StepTitle,
  docsUrl,
} from "../../primitives";
import { doneCount, timeAgo, type Platform } from "../../setupRules";
import type { SetupData } from "../../useSetupData";
import { SendToDeveloperDialog } from "../../SendToDeveloperDialog";
import { PartList } from "./PartList";
import { OptionalSetup, type OptionalKey } from "./OptionalSetup";
import {
  useAndroidGuide,
  useIosGuide,
  useWebGuide,
  type Guide,
} from "./guides";

const PLATFORM_LABEL: Record<Platform, string> = {
  ios: "iOS",
  android: "Android",
  web: "Web",
};

const firstOpen = (guide: Guide) => {
  const i = guide.parts.findIndex((p) => !p.done);
  return i === -1 ? guide.parts.length : i;
};

const OptionalHelp = ({
  platform,
  which,
}: {
  platform: Platform;
  which: OptionalKey;
}) => {
  if (which === "push" && platform === "ios")
    return (
      <HelpDocs>
        <HelpTitle>Create an APNs key</HelpTitle>
        <ol>
          <li>
            Go to{" "}
            <b>
              developer.apple.com → Certificates, Identifiers &amp; Profiles →
              Keys
            </b>
            .
          </li>
          <li>
            Click <b>+</b>, name it, tick{" "}
            <b>Apple Push Notifications service (APNs)</b>.
          </li>
          <li>
            Download the <b>.p8</b> file. Apple lets you download it only once.
          </li>
        </ol>
        <HelpPitfalls
          items={[
            "Uploading a .p12 certificate instead of the .p8 key.",
            "Using a Key ID from another team.",
          ]}
        />
        <HelpLinks>
          <DocLink href={docsUrl("/docs/sdk/ios/messages")}>
            iOS push notifications in Grovs docs
          </DocLink>
        </HelpLinks>
      </HelpDocs>
    );
  if (which === "push")
    return (
      <HelpDocs>
        <HelpTitle>Get the Firebase key</HelpTitle>
        <ol>
          <li>
            Open <b>Firebase console → Project settings → Service accounts</b>.
          </li>
          <li>
            Choose <b>Generate new private key</b> and keep the JSON file.
          </li>
          <li>
            The project ID is under <b>Project settings → General</b>.
          </li>
        </ol>
        <HelpLinks>
          <DocLink href={docsUrl("/docs/sdk/android/messages")}>
            Android push notifications in Grovs docs
          </DocLink>
        </HelpLinks>
      </HelpDocs>
    );
  return (
    <HelpDocs>
      <HelpTitle>
        {platform === "ios" ? "Where to paste the URLs" : "Connect Google Play"}
      </HelpTitle>
      {platform === "ios" ? (
        <ol>
          <li>
            Open <b>App Store Connect</b> and pick your app.
          </li>
          <li>
            <b>App Information</b> → <b>App Store Server Notifications</b>.
          </li>
          <li>
            Choose <b>Version 2</b> and paste the Production and Sandbox URLs.
          </li>
        </ol>
      ) : (
        <ol>
          <li>
            Download and run the setup script. It creates the Pub/Sub topic and
            push subscription.
          </li>
          <li>
            In <b>Play Console</b>, open <b>Monetization setup</b> →{" "}
            <b>Real-time developer notifications</b> and enter the topic name
            the script printed.
          </li>
          <li>Upload the service account key it saved here.</li>
        </ol>
      )}
      <HelpPitfalls
        title="Good to know"
        items={[
          "Nothing changes in your app code; the store sends purchases straight to Grovs.",
        ]}
      />
      <HelpLinks>
        <DocLink href={docsUrl(`/docs/sdk/${platform}/revenue`)}>
          Revenue in Grovs docs
        </DocLink>
      </HelpLinks>
    </HelpDocs>
  );
};

/** Step 2: per-platform parts with written help, live connection check, optional push and revenue. */
export const ConnectStep = ({
  instance,
  data,
  platform,
  onPlatform,
  onBack,
  onNext,
}: {
  instance: Instance;
  data: SetupData;
  platform: Platform;
  onPlatform: (platform: Platform) => void;
  onBack: () => void;
  onNext: () => void;
}) => {
  const guides: Record<Platform, Guide> = {
    ios: useIosGuide(instance, data),
    android: useAndroidGuide(instance, data),
    web: useWebGuide(instance, data),
  };
  const guide = guides[platform];
  const [openParts, setOpenParts] = useState<Partial<Record<Platform, number>>>(
    {}
  );
  const [expanded, setExpanded] = useState<Partial<Record<Platform, boolean>>>(
    {}
  );
  const [optional, setOptional] = useState<OptionalKey | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [busy, setBusy] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  const parts = guide.parts;
  const allDone = parts.every((p) => p.done);
  const open = openParts[platform] ?? firstOpen(guide);
  const collapsed =
    allDone && !expanded[platform] && openParts[platform] === undefined;
  const openPart = collapsed ? undefined : parts[open];
  const runPart = parts[parts.length - 1]!;
  const seen = data.platforms[platform].seen;
  // Another platform connecting is enough to move on.
  const appDone = data.signals.appConnected || data.signals.appMarked;
  const runReady = seen || appDone;

  const setOpen = (index: number) =>
    setOpenParts((prev) => ({ ...prev, [platform]: index }));

  // Saves a part without moving on; skips parts already saved or still incomplete.
  const settling = useRef(new Set<string>());
  const settle = (index: number) => {
    const part = parts[index];
    if (!part || part.done || part.key === "run") return;
    if (!guide.canSubmit(part.key)) return;
    const id = `${platform}:${part.key}`;
    if (settling.current.has(id)) return;
    settling.current.add(id);
    void guide.submit(part.key).finally(() => settling.current.delete(id));
  };

  // Another platform is already connected, so an untouched one can wait.
  const skippable =
    !!openPart &&
    appDone &&
    doneCount(parts) === 0 &&
    !guide.canSubmit(openPart.key);

  const handleContinue = async () => {
    if (!openPart || skippable) {
      onNext();
      return;
    }
    if (openPart.key === "run") {
      if (runReady) onNext();
      return;
    }
    setBusy(true);
    const ok = await guide.submit(openPart.key);
    setBusy(false);
    if (!ok) return;
    const after = parts.findIndex((p, i) => i > open && !p.done);
    setOpen(after === -1 ? parts.length - 1 : after);
  };

  const canContinue =
    !openPart ||
    skippable ||
    (openPart.key === "run"
      ? runReady
      : guide.canSubmit(openPart.key) && !busy && !guide.saving);

  const tabs = (size: "sm" | "md") => (
    <Segmented
      label="Platform"
      size={size}
      className={size === "sm" ? "self-center" : undefined}
      value={platform}
      onChange={(p) => {
        onPlatform(p);
        setOptional(null);
      }}
      options={(["ios", "android", "web"] as Platform[]).map((p) => {
        const g = guides[p];
        const n = doneCount(g.parts);
        const complete = n === g.parts.length;
        return {
          value: p,
          label: PLATFORM_LABEL[p],
          icon: (
            <PlatformIcon
              platform={p}
              alt=""
              className={cn("opacity-80", p === platform && "opacity-100")}
            />
          ),
          extra: complete ? (
            <span
              role="img"
              aria-label="Connected"
              className="grid size-4 place-items-center rounded-full bg-valid-green text-white"
            >
              <Check className="size-2.5 stroke-[3]" />
            </span>
          ) : p === "web" && n === 0 ? (
            <span className="text-[11.5px] font-normal text-muted-foreground/70">
              Optional
            </span>
          ) : (
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              {n}/{g.parts.length}
            </span>
          ),
        };
      })}
    />
  );

  const left = (
    <>
      <div className="sticky -top-7 z-10 -mx-4 h-0 sm:-top-10 sm:-mx-10 lg:-mr-14 lg:-ml-16">
        <div
          aria-hidden={!compact}
          className={cn(
            "absolute inset-x-0 top-0 flex h-[58px] items-center gap-4 bg-background px-4 shadow-[0_1px_0_var(--border)] transition-[opacity,transform] duration-150 sm:px-10 lg:pr-14 lg:pl-16",
            compact
              ? "opacity-100"
              : "pointer-events-none -translate-y-1.5 opacity-0"
          )}
        >
          <b className="hidden flex-1 text-[15px] font-semibold whitespace-nowrap sm:block">
            Connect your app
          </b>
          {tabs("sm")}
        </div>
      </div>
      <div ref={headerRef}>
        <StepTitle>Connect your app</StepTitle>
        <Lead>
          Set up each platform your app runs on. About 10 minutes each; every
          part is saved as you go.
        </Lead>
        <div className="mb-2.5">{tabs("md")}</div>
      </div>
      <PartList
        parts={parts}
        open={collapsed ? -1 : open}
        onSettle={settle}
        onOpen={(i) => {
          // Moving on from a part by clicking another one counts as doing it.
          if (i !== open) settle(open);
          setOpen(i);
          setOptional(null);
        }}
        collapsed={collapsed}
        onExpand={() => setExpanded((prev) => ({ ...prev, [platform]: true }))}
      />
      <OptionalSetup
        platform={platform}
        instance={instance}
        data={data}
        open={optional}
        onToggle={(key) => setOptional((cur) => (cur === key ? null : key))}
      />
    </>
  );

  const right: ReactNode = optional ? (
    <OptionalHelp platform={platform} which={optional} />
  ) : (
    (openPart ?? runPart).help
  );

  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/setup?instance_id=${instance.id}&step=app&platform=${platform}`
      : "";

  let status: ReactNode = (
    <button
      type="button"
      onClick={() => setInviteOpen(true)}
      className="flex items-center gap-[9px] text-[13.5px]"
    >
      <Mail className="size-[15px]" />
      <span className="underline decoration-foreground/25 underline-offset-[3px] hover:decoration-foreground/60">
        Send to your developer
      </span>
    </button>
  );
  if (openPart?.key === "run") {
    status = seen ? (
      <span className="flex items-center gap-[9px] text-[13.5px]">
        <span className="size-2 rounded-full bg-valid-green" />
        Connected
        <span className="text-muted-foreground">
          {data.platforms[platform].seenAt
            ? timeAgo(data.platforms[platform].seenAt!)
            : ""}
        </span>
      </span>
    ) : (
      <span className="flex items-center gap-[9px] text-[13.5px]">
        <Spinner />
        Waiting for your {platform === "web" ? "site" : "app"}
        <span className="hidden text-muted-foreground sm:inline">
          ·{" "}
          <a
            href={docsUrl(`/docs/sdk/${platform}/quick-start`)}
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline decoration-foreground/25 underline-offset-[3px] hover:decoration-foreground/60"
          >
            Not showing up?
          </a>
        </span>
      </span>
    );
  }

  return (
    <>
      <StepPage
        left={left}
        right={right}
        onLeftScroll={(e) => {
          const h = headerRef.current?.offsetHeight ?? 0;
          setCompact(e.currentTarget.scrollTop > h - 30);
        }}
        footer={
          <>
            {status}
            <FooterSpacer />
            <QuietButton onClick={onBack} className="hidden sm:inline-flex">
              Back
            </QuietButton>
            {openPart?.key === "run" && !runReady && !skippable && (
              <QuietButton onClick={onNext}>Skip for now</QuietButton>
            )}
            <PrimaryButton disabled={!canContinue} onClick={handleContinue}>
              Continue
            </PrimaryButton>
          </>
        }
      />
      <SendToDeveloperDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        instanceId={instance.id}
        link={link}
      />
    </>
  );
};
