"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ProjectIcon } from "@/components/layout/project-icon";

// A modern iPhone, drawn at roughly three quarters of real size.
export const PhoneFrame = ({
  children,
  statusTone = "auto",
  compact = false,
}: {
  children: ReactNode;
  statusTone?: "auto" | "light";
  /** Leaves room below for a checklist on short screens. */
  compact?: boolean;
}) => (
  <div
    data-testid="phone-frame"
    className={cn(
      "relative aspect-[292/604] w-auto min-h-[400px] shrink-0 rounded-[52px] bg-[linear-gradient(160deg,#C9CACC,#7D7E82_30%,#4A4B4F_60%,#A9AAAD)] p-1 shadow-[0_50px_90px_-45px_rgba(0,0,0,.55)]",
      compact
        ? "h-[min(604px,calc(100dvh-360px))]"
        : "h-[min(604px,calc(100dvh-210px))]"
    )}
  >
    <div className="h-full w-full rounded-[48px] bg-[#050505] p-1">
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[44px] bg-white font-[-apple-system,'SF_Pro_Text',var(--font-geist-sans)] text-black dark:bg-black dark:text-white">
        <div className="absolute top-[11px] left-1/2 z-[3] h-[27px] w-[92px] -translate-x-1/2 rounded-[14px] bg-black" />
        <StatusBar light={statusTone === "light"} />
        {children}
        <div className="absolute bottom-1.5 left-1/2 h-1 w-[100px] -translate-x-1/2 rounded-[3px] bg-black dark:bg-white" />
      </div>
    </div>
  </div>
);

const StatusBar = ({ light }: { light: boolean }) => (
  <div
    className={cn(
      "absolute inset-x-0 top-0 z-[3] grid h-[49px] grid-cols-[1fr_92px_1fr] items-center px-1.5 text-[12.6px] font-semibold tracking-[-0.01em]",
      light && "text-white"
    )}
  >
    <span className="-translate-y-px pl-2.5 text-center">9:41</span>
    <span />
    <span className="flex items-center justify-center gap-[5px] pr-1.5">
      <svg width="15" height="10" viewBox="0 0 15 10" aria-hidden>
        <rect
          x="0"
          y="6.6"
          width="2.6"
          height="3.4"
          rx=".7"
          fill="currentColor"
        />
        <rect
          x="4.1"
          y="4.6"
          width="2.6"
          height="5.4"
          rx=".7"
          fill="currentColor"
        />
        <rect
          x="8.2"
          y="2.4"
          width="2.6"
          height="7.6"
          rx=".7"
          fill="currentColor"
        />
        <rect
          x="12.3"
          y="0"
          width="2.6"
          height="10"
          rx=".7"
          fill="currentColor"
        />
      </svg>
      <svg width="23" height="11" viewBox="0 0 23 11" aria-hidden>
        <rect
          x=".5"
          y=".5"
          width="19.5"
          height="10"
          rx="2.8"
          fill="none"
          stroke="currentColor"
          opacity=".38"
        />
        <rect
          x="2"
          y="2"
          width="16.5"
          height="7"
          rx="1.6"
          fill="currentColor"
        />
        <path
          d="M21.2 3.6v3.8c.7-.25 1.2-1 1.2-1.9s-.5-1.65-1.2-1.9z"
          fill="currentColor"
          opacity=".45"
        />
      </svg>
    </span>
  </div>
);

const Bubble = ({ out, children }: { out?: boolean; children: ReactNode }) => (
  <div
    className={cn(
      "max-w-[74%] rounded-[14px] px-[9px] pt-[5px] pb-1.5",
      out
        ? "self-end bg-[#007AFF] text-white"
        : "self-start bg-[#E9E9EB] dark:bg-[#262629]"
    )}
  >
    {children}
  </div>
);

const Stamp = ({ children }: { children: ReactNode }) => (
  <div className="mt-0.5 mb-1.5 text-center text-[8.5px] text-[#8E8E93]">
    {children}
  </div>
);

/** iMessage thread ending in a shared link, using the project's real preview. */
export const MessagePreview = ({
  projectName,
  title,
  host,
  imageUrl,
}: {
  projectName: string;
  title: string;
  host: string;
  imageUrl: string | null;
}) => (
  <PhoneFrame>
    <div className="relative flex shrink-0 flex-col items-center gap-[3px] border-b border-black/[0.06] bg-[#FAFAFA]/95 pt-[52px] pb-2 dark:border-white/10 dark:bg-[#121214]/95">
      <span className="absolute top-[58px] left-2.5 text-[22px] leading-none font-light text-[#007AFF] dark:text-[#0A84FF]">
        ‹
      </span>
      <div className="grid size-[37px] place-items-center rounded-full bg-[linear-gradient(180deg,#AEB3BC,#878C96)] text-sm font-medium text-white">
        MR
      </div>
      <div className="flex items-center gap-0.5 text-[9.5px]">
        Maria Rossi<span className="text-[#C7C7CC]">›</span>
      </div>
    </div>
    <div className="flex flex-1 flex-col justify-end gap-0.5 overflow-hidden px-[9px] py-1.5 text-[12.6px] leading-[1.3] tracking-[-0.01em]">
      <Stamp>
        iMessage
        <br />
        Yesterday 18:12
      </Stamp>
      <Bubble out>Did you get the app I told you about?</Bubble>
      <Bubble>Downloaded it this morning 👍</Bubble>
      <div className="mt-2">
        <Stamp>Today 9:38</Stamp>
      </div>
      <Bubble>Is the summer sale on {projectName} live yet?</Bubble>
      <Bubble out>Yes! Here you go</Bubble>
      <div
        data-testid="link-card"
        className="mt-[3px] w-[70%] self-end overflow-hidden rounded-[14px] bg-[#E9E9EB] dark:bg-[#262629]"
      >
        <div className="h-[84px] bg-[#F4F5F7] dark:bg-[#18191B]">
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="size-full object-cover" />
          )}
        </div>
        <div className="px-[9px] pt-1.5 pb-2">
          <b className="block truncate text-[10.5px] leading-tight font-semibold">
            {title}
          </b>
          <span className="block truncate text-[9.5px] text-[#8E8E93]">
            {host}
          </span>
        </div>
      </div>
      <div className="mx-[3px] mt-0.5 mb-1 self-end text-[8.5px] text-[#8E8E93]">
        Read 9:39
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-1.5 px-2 pt-[5px] pb-6">
      <span className="grid size-[26px] place-items-center rounded-full bg-[#E9E9EB] text-[#7C7C80] dark:bg-[#262629] dark:text-[#9A9A9F]">
        <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
          <path
            d="M7 2v10M2 7h10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="flex h-[26px] flex-1 items-center rounded-[13px] border border-[#D1D1D6] pl-2.5 text-[12.6px] text-[#B9B9BE] dark:border-[#3A3A3C] dark:text-[#5A5A5E]">
        iMessage
      </span>
    </div>
  </PhoneFrame>
);

const HOME_APPS = [
  "Maps",
  "Photos",
  "Camera",
  null,
  "Notes",
  "Weather",
  "Clock",
  "Music",
  "Wallet",
  "Podcasts",
  "News",
  "Settings",
];

/** Home screen with muted icons except the project's own, waiting for or confirming the first open. */
export const HomeScreenPreview = ({
  projectName,
  iconUrl,
  connected,
}: {
  projectName: string;
  iconUrl?: string | null;
  connected: boolean;
}) => (
  <PhoneFrame compact>
    <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_0%,#9FB8F0_0%,#C8B7E6_45%,#F0C9C2_100%)] px-4 pt-[58px] dark:bg-[radial-gradient(120%_80%_at_20%_0%,#24345C_0%,#3A2D55_50%,#4B2C35_100%)]">
      <div className="mb-3 h-[78px] rounded-[20px] bg-white/35 px-3 py-2.5 text-[10px] text-[#1d1d1f] backdrop-blur-md dark:bg-white/12 dark:text-white">
        <span>
          {new Date().toLocaleDateString("en-GB", { weekday: "long" })}
        </span>
        <b className="block text-xl leading-tight font-light tracking-[-0.02em]">
          {new Date().getDate()}
        </b>
        <span>No events today</span>
      </div>
      <div className="grid grid-cols-4 justify-items-center gap-y-[9px]">
        {HOME_APPS.map((app, i) =>
          app ? (
            <div
              key={app}
              className="flex w-14 flex-col items-center gap-[3px] text-[8.5px] text-[#1d1d1f]/70 dark:text-white/70"
            >
              <i className="block size-[42px] rounded-[10px] bg-white/55 shadow-[inset_0_0_0_.5px_rgba(0,0,0,.06)] dark:bg-white/14" />
              <span>{app}</span>
            </div>
          ) : (
            <div
              key={`me-${i}`}
              className="relative flex w-14 flex-col items-center gap-[3px] text-[8.5px] font-semibold text-[#1d1d1f] dark:text-white"
            >
              <span className="relative">
                <ProjectIcon
                  url={iconUrl}
                  name={projectName}
                  className="size-[42px] rounded-[10px] bg-[linear-gradient(160deg,#5B8CFF,#2A5BFF)] text-[15px] font-semibold text-white ring-0"
                />
                {!connected && (
                  <span className="absolute -inset-1.5 animate-pulse rounded-[15px] border-2 border-white/90" />
                )}
              </span>
              <span className="max-w-full truncate">
                {projectName.split(" ")[0]}
              </span>
            </div>
          )
        )}
      </div>
      <div className="absolute inset-x-2.5 bottom-5 flex h-[62px] items-center justify-around rounded-[26px] bg-white/35 backdrop-blur-md dark:bg-white/12">
        {[0, 1, 2, 3].map((i) => (
          <i
            key={i}
            className="block size-[42px] rounded-[10px] bg-white/55 dark:bg-white/14"
          />
        ))}
      </div>
    </div>
    {connected && (
      <div className="absolute inset-x-2 top-12 z-[4] flex items-center gap-[9px] rounded-[18px] bg-[#FAFAFA]/92 px-[11px] py-[9px] text-[10.5px] text-black shadow-[0_8px_20px_-10px_rgba(0,0,0,.3)] backdrop-blur-md dark:bg-[#28282C]/92 dark:text-white">
        <ProjectIcon
          url={iconUrl}
          name={projectName}
          className="size-7 rounded-[7px] bg-[linear-gradient(160deg,#5B8CFF,#2A5BFF)] text-[10px] font-semibold text-white ring-0"
        />
        <span className="min-w-0">
          <b className="block font-semibold">{projectName}</b>
          Connected to Grovs. First open recorded.
        </span>
        <span className="ml-auto self-start text-[9px] text-[#8E8E93]">
          now
        </span>
      </div>
    )}
  </PhoneFrame>
);
