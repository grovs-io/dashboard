"use client";

import type { ReactNode } from "react";
import { ChartColumn, Link2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDomainConfigQuery } from "@/hooks/queries/useConfigurationQueries";
import { useLinkLastOpenQuery } from "@/hooks/queries/useLinksQueries";
import type { Instance } from "@/types";
import {
  FooterSpacer,
  Lead,
  OkMark,
  PendingMark,
  PrimaryButton,
  StepPage,
} from "../primitives";
import { stripScheme, type Platform, type SetupStepKey } from "../setupRules";
import type { SetupData } from "../useSetupData";
import { SharePreviewPhone } from "./domain/DomainStep";
import { readFirstLink } from "./TryStep";

const SummaryRow = ({
  ok,
  label,
  value,
  action,
  onAction,
  accent,
}: {
  ok: boolean;
  label: string;
  value: ReactNode;
  action: string;
  onAction: () => void;
  accent?: boolean;
}) => (
  <div className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-3 border-t border-border px-4 py-[13px] text-[13.5px] first:border-t-0 sm:grid-cols-[22px_150px_minmax(0,1fr)_auto]">
    {ok ? (
      <OkMark />
    ) : (
      <span className="grid place-items-center">
        <PendingMark />
      </span>
    )}
    <span className="hidden text-muted-foreground sm:block">{label}</span>
    <span
      className={cn(
        "truncate font-medium",
        !ok && "font-normal text-muted-foreground"
      )}
    >
      <span className="mr-1.5 font-normal text-muted-foreground sm:hidden">
        {label}
      </span>
      {value}
    </span>
    <button
      type="button"
      onClick={onAction}
      className={cn(
        "text-[12.5px] text-muted-foreground underline decoration-foreground/20 underline-offset-[3px] hover:text-foreground",
        accent &&
          "text-chart-users no-underline hover:text-[var(--chart-users-hover)]"
      )}
    >
      {action}
    </button>
  </div>
);

const NextCard = ({
  icon,
  title,
  text,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-xl border border-foreground/[0.11] p-3.5 text-left transition-colors hover:border-foreground/20"
  >
    <span className="grid size-[30px] place-items-center rounded-lg border border-foreground/[0.11] bg-muted text-foreground/75 dark:bg-white/[0.03] [&_svg]:size-[15px]">
      {icon}
    </span>
    <b className="mt-2 mb-[3px] block text-[13.5px] font-semibold">{title}</b>
    <span className="text-[12.5px] leading-[1.45] text-muted-foreground">
      {text}
    </span>
  </button>
);

/** The finish line: what's set up, what's left, and where to go next. */
export const DoneStep = ({
  instance,
  data,
  onEdit,
  onNavigate,
}: {
  instance: Instance;
  data: SetupData;
  onEdit: (step: SetupStepKey, platform?: Platform) => void;
  onNavigate: (href: string) => void;
}) => {
  const prod = instance.production;
  const name = prod?.name ?? instance.name;
  const { data: domain } = useDomainConfigQuery(prod?.id);
  const link = readFirstLink(instance.id);
  const { data: opened } = useLinkLastOpenQuery(prod?.id, link?.id, false);
  const host =
    data.primaryDomain?.hostname ??
    (domain ? `${domain.subdomain}.${domain.domain}` : "");
  const fallback = data.redirectConfig?.default_fallback;
  const iosSaved = data.redirectConfig?.ios?.phone;
  const linksSummary = [
    data.platforms.ios.registered || data.platforms.android.registered
      ? iosSaved?.enabled === false
        ? "Web page"
        : iosSaved?.appstore === false
          ? "App, else custom page"
          : "App, else store"
      : "Custom pages",
    fallback ? stripScheme(fallback).replace(/\/$/, "") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const appRow = (p: Platform, label: string) => {
    const s = data.platforms[p];
    const id =
      p === "ios"
        ? s.config?.configuration?.bundle_id
        : p === "android"
          ? s.config?.configuration?.identifier
          : s.config?.configuration?.domains?.[0];
    return (
      <SummaryRow
        key={p}
        ok={s.seen}
        label={label}
        value={
          s.seen
            ? id
            : s.registered
              ? "Waiting for first open"
              : "Not connected"
        }
        action={s.seen ? "Edit" : "Connect"}
        accent={!s.seen}
        onAction={() => onEdit("app", p)}
      />
    );
  };

  const left = (
    <div className="max-w-[600px]">
      <div className="mb-[22px] flex items-center gap-3.5">
        <OkMark className="size-10 [&_svg]:size-[18px]" label="Set up" />
        <div>
          <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.02em] sm:text-2xl">
            {name} is set up
          </h1>
          <Lead className="mt-1 mb-0">
            {data.signals.appConnected || data.signals.appMarked
              ? "Links open your app, and installs and opens show up on Home."
              : "Links work now. Connect the rest of your app whenever you're ready."}
          </Lead>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-foreground/[0.11]">
        <SummaryRow
          ok={data.signals.domainMarked || data.signals.customDomain || !!host}
          label="Link domain"
          value={host}
          action="Edit"
          onAction={() => onEdit("domain")}
        />
        {appRow("ios", "iOS app")}
        {appRow("android", "Android app")}
        {data.platforms.web.registered && appRow("web", "Website")}
        <SummaryRow
          ok={data.signals.fallbackSet}
          label="Where links go"
          value={data.signals.fallbackSet ? linksSummary : "Fallback not set"}
          action="Edit"
          onAction={() => onEdit("links")}
        />
        <SummaryRow
          ok={!!link || data.signals.hasLinks}
          label="First link"
          value={
            link
              ? `${link.path} · ${opened ? "opened" : "created"}`
              : data.signals.hasLinks
                ? "Created"
                : "Not made yet"
          }
          action={link || data.signals.hasLinks ? "View" : "Create"}
          accent={!link && !data.signals.hasLinks}
          onAction={() =>
            link || data.signals.hasLinks
              ? onNavigate("/dynamic_links/links")
              : onEdit("try")
          }
        />
      </div>
      <div className="mt-[22px] grid gap-2.5 sm:grid-cols-3">
        <NextCard
          icon={<Link2 />}
          title="Create more links"
          text="One per campaign, product or share button."
          onClick={() => onNavigate("/dynamic_links/links")}
        />
        <NextCard
          icon={<Users />}
          title="Invite your team"
          text="Marketing can make links without you."
          onClick={() => onNavigate("/settings/team")}
        />
        <NextCard
          icon={<ChartColumn />}
          title="Watch the numbers"
          text="Installs, opens and sources on Home."
          onClick={() => onNavigate("/dashboard")}
        />
      </div>
    </div>
  );

  return (
    <StepPage
      left={left}
      right={<SharePreviewPhone instance={instance} host={host} />}
      footer={
        <>
          <FooterSpacer />
          <PrimaryButton onClick={() => onNavigate("/dashboard")}>
            Go to Home
          </PrimaryButton>
        </>
      }
    />
  );
};
