"use client";

import type { ReactNode } from "react";
import {
  ExternalLink,
  Globe,
  Laptop,
  QrCode,
  Smartphone,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PlatformIcon } from "@/components/analytics/shared";
import { stripScheme } from "../../setupRules";
import type { RedirectRulesFormValues } from "@/schemas/redirect";

export type LinksTab = "ios" | "android" | "desktop";

const Branch = ({
  when,
  icon,
  text,
  code,
  app,
  danger,
}: {
  when: string;
  icon?: ReactNode;
  text: string;
  code?: string;
  app?: boolean;
  danger?: boolean;
}) => (
  <div className="relative flex items-center gap-2 py-1.5 pl-[22px] text-[12.5px] before:absolute before:top-0 before:bottom-1/2 before:left-0 before:w-3.5 before:rounded-bl-md before:border-b-[1.5px] before:border-l-[1.5px] before:border-foreground/15 [&:not(:last-child)]:after:absolute [&:not(:last-child)]:after:top-1/2 [&:not(:last-child)]:after:bottom-0 [&:not(:last-child)]:after:left-0 [&:not(:last-child)]:after:border-l-[1.5px] [&:not(:last-child)]:after:border-foreground/15">
    <span className="w-[84px] shrink-0 text-muted-foreground">{when}</span>
    {danger ? (
      <span className="text-destructive">{text}</span>
    ) : (
      <span className="inline-flex min-w-0 items-center gap-1.5 font-medium">
        <i
          className={cn(
            "grid size-[18px] shrink-0 place-items-center rounded-[5px] bg-foreground/[0.05] text-foreground/75 not-italic [&_svg]:size-[11px]",
            app && "bg-chart-users/10 text-chart-users"
          )}
        >
          {icon}
        </i>
        <span className="truncate">{text}</span>
      </span>
    )}
    {code && (
      <code className="ml-auto max-w-[45%] truncate font-mono text-[11.5px] text-muted-foreground">
        {code}
      </code>
    )}
  </div>
);

const Card = ({
  editing,
  icon,
  title,
  children,
}: {
  editing: boolean;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) => (
  <div
    className={cn(
      "mb-2.5 rounded-xl border border-foreground/[0.11] bg-background px-3.5 py-3",
      editing && "border-chart-users/45"
    )}
  >
    <div className="flex items-center gap-2 text-[13px] font-semibold">
      {icon}
      {title}
      {editing && (
        <span className="ml-auto text-[11.5px] font-medium text-chart-users">
          Editing
        </span>
      )}
    </div>
    <div className="mt-2 ml-1.5">{children}</div>
  </div>
);

const short = (url: string) => stripScheme(url).replace(/\/$/, "");

/** Where a link sends each kind of visitor, one card per destination. */
export const RouteMap = ({
  values,
  tab,
  host,
  projectName,
  connected,
}: {
  values: RedirectRulesFormValues;
  tab: LinksTab | null;
  host: string;
  projectName: string;
  connected: { ios: boolean; android: boolean };
}) => {
  const path = "/summer-sale";
  const fallback = values.defaultUrl;
  const phone = (p: "ios" | "android", store: string) => {
    const v = values[p];
    if (!connected[p] || !v.enabled)
      return (
        <Branch
          when="Always"
          icon={v.customUrl ? <ExternalLink /> : <Globe />}
          text={v.customUrl ? "Custom page" : "Default fallback"}
          code={short(v.customUrl || fallback)}
        />
      );
    return (
      <>
        <Branch
          when="App installed"
          icon={<Smartphone />}
          text={`Opens ${projectName}`}
          code={path}
          app
        />
        {v.appStore ? (
          <Branch
            when="Not installed"
            icon={<Store />}
            text={`${store}, then the app`}
          />
        ) : (
          <Branch
            when="Not installed"
            icon={<ExternalLink />}
            text="Custom page"
            code={short(v.customUrl)}
          />
        )}
      </>
    );
  };
  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-3.5 flex justify-center">
        <span className="max-w-full truncate rounded-full border border-foreground/[0.11] bg-background px-3 py-[5px] font-mono text-[12.5px]">
          {host}
          {path}
        </span>
      </div>
      <Card
        editing={tab === "ios"}
        icon={<PlatformIcon platform="ios" alt="" />}
        title="iPhone"
      >
        {phone("ios", "App Store")}
      </Card>
      <Card
        editing={tab === "android"}
        icon={<PlatformIcon platform="android" alt="" />}
        title="Android"
      >
        {phone("android", "Google Play")}
      </Card>
      <Card
        editing={tab === "desktop"}
        icon={<Laptop className="size-3.5" />}
        title="Computer"
      >
        {values.desktop.generatedPage ? (
          <Branch
            when="Always"
            icon={<QrCode />}
            text="Grovs page with QR code"
          />
        ) : (
          <Branch
            when="Always"
            icon={<ExternalLink />}
            text="Custom page"
            code={short(values.desktop.customUrl || fallback)}
          />
        )}
      </Card>
      <Card
        editing={false}
        icon={<Globe className="size-3.5" />}
        title="Anything else"
      >
        {fallback ? (
          <Branch
            when="Always"
            icon={<Globe />}
            text="Default fallback"
            code={short(fallback)}
          />
        ) : (
          <Branch when="Always" text="Fallback not set" danger />
        )}
      </Card>
    </div>
  );
};
