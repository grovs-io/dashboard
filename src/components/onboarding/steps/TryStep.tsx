"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/apiErrorHelpers";
import { useUserContext } from "@/context/useUserContext";
import { useCreateLinkMutation } from "@/hooks/mutations/useLinksMutations";
import { useLinkLastOpenQuery } from "@/hooks/queries/useLinksQueries";
import { useDomainConfigQuery } from "@/hooks/queries/useConfigurationQueries";
import {
  availablePathAPICall,
  getRandomPathAPICall,
  type LinkLastOpen,
} from "@/api/links/linksService";
import type { Instance } from "@/types";
import {
  ErrorText,
  FieldLabel,
  FooterSpacer,
  Hint,
  Lead,
  OkMark,
  OutlineButton,
  PanelCaption,
  PrimaryButton,
  QuietButton,
  SetupInput,
  Spinner,
  StepPage,
  StepTitle,
  docsUrl,
  useCopy,
} from "../primitives";
import { slugify, stripScheme, timeAgo } from "../setupRules";

export interface FirstLink {
  id: string;
  name: string;
  path: string;
  url: string;
  data?: Record<string, string>;
}

const storageKey = (instanceId: string) =>
  `grovs.setup.firstLink.${instanceId}`;

export function readFirstLink(instanceId: string): FirstLink | null {
  try {
    const raw = localStorage.getItem(storageKey(instanceId));
    return raw ? (JSON.parse(raw) as FirstLink) : null;
  } catch {
    return null;
  }
}

function writeFirstLink(instanceId: string, link: FirstLink) {
  try {
    localStorage.setItem(storageKey(instanceId), JSON.stringify(link));
  } catch {
    // Only a convenience: without it the step offers a fresh link.
  }
}

const PLATFORM_NAME: Record<string, string> = {
  ios: "iOS",
  android: "Android",
  web: "Web",
};

export const describeOpen = (open: LinkLastOpen) =>
  [
    open.model || PLATFORM_NAME[open.platform ?? ""] || "A phone",
    open.platform && open.model ? PLATFORM_NAME[open.platform] : null,
    timeAgo(open.opened_at),
  ]
    .filter(Boolean)
    .join(" · ");

async function freePath(projectId: string, name: string): Promise<string> {
  const base = slugify(name) || "first-link";
  for (const candidate of [
    base,
    `${base}-${Math.random().toString(36).slice(2, 6)}`,
  ]) {
    try {
      if ((await availablePathAPICall(projectId, candidate)).data.available)
        return candidate;
    } catch {
      break;
    }
  }
  return (await getRandomPathAPICall(projectId)).data.valid_path;
}

const LinkBox = ({ url }: { url: string }) => {
  const { copied, copy } = useCopy();
  return (
    <div className="flex h-12 max-w-[560px] items-center gap-2 rounded-[10px] border border-chart-users/45 bg-chart-users/[0.04] pr-1.5 pl-3.5 font-mono text-sm dark:bg-chart-users/[0.07]">
      <span className="min-w-0 flex-1 truncate">{stripScheme(url)}</span>
      <button
        type="button"
        onClick={() => copy(url)}
        className="inline-flex h-[34px] items-center gap-1.5 rounded-[7px] border border-foreground/[0.13] bg-background px-3 font-sans text-[13px] font-medium"
      >
        <Copy className="size-[13px]" />
        {copied ? "Copied" : "Copy"}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-[34px] items-center gap-1.5 rounded-[7px] border border-foreground/[0.13] bg-background px-3 font-sans text-[13px] font-medium"
      >
        <ExternalLink className="size-[13px]" />
        Open
      </a>
    </div>
  );
};

/** Step 4: create the first link, scan it, and see it open the app. */
export const TryStep = ({
  instance,
  onBack,
  onFinish,
}: {
  instance: Instance;
  onBack: () => void;
  onFinish: () => void;
}) => {
  const prod = instance.production;
  const projectName = prod?.name ?? instance.name;
  const dark = useTheme().resolvedTheme === "dark";
  const { user } = useUserContext();
  const { data: domain } = useDomainConfigQuery(prod?.id);
  const create = useCreateLinkMutation(prod?.id, instance.id);
  const [link, setLink] = useState<FirstLink | null>(() =>
    readFirstLink(instance.id)
  );
  const [name, setName] = useState(link?.name ?? "");
  const [rows, setRows] = useState<{ key: string; value: string }[]>(() =>
    Object.entries(link?.data ?? {}).map(([key, value]) => ({ key, value }))
  );
  const [error, setError] = useState<string | null>(null);
  const { data: opened } = useLinkLastOpenQuery(prod?.id, link?.id, 3000);

  const createLink = async () => {
    if (!prod?.id) return;
    setError(null);
    const finalName = name.trim() || "First link";
    try {
      const path = await freePath(prod.id, finalName);
      const form = new FormData();
      form.append("name", finalName);
      form.append("path", path);
      const data = Object.fromEntries(
        rows
          .map((r) => [r.key.trim(), r.value.trim()] as const)
          .filter(([k, v]) => k && v)
      );
      if (Object.keys(data).length > 0)
        form.append("data", JSON.stringify(data));
      const created = (await create.mutateAsync(form)).data.link;
      const host = domain ? `${domain.subdomain}.${domain.domain}` : "";
      const next: FirstLink = {
        id: String(created.id),
        name: created.name ?? finalName,
        path: created.path,
        url: created.access_path ?? `https://${host}/${created.path}`,
        data,
      };
      writeFirstLink(instance.id, next);
      setLink(next);
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't create the link. Try again."));
    }
  };

  const phoneMail = link
    ? `mailto:${user?.email ?? ""}?subject=${encodeURIComponent(`Open ${projectName}`)}&body=${encodeURIComponent(link.url)}`
    : undefined;

  const left = (
    <>
      <StepTitle>Your first link</StepTitle>
      <Lead className="mb-2">
        {link
          ? `It's ready to use. Open it on a phone with ${projectName} to see it open the app.`
          : `Make a link and open it on a phone with ${projectName} to see it open the app.`}
      </Lead>
      <Hint className="mt-0 mb-6 max-w-[560px]">
        Use a build with <code className="font-mono">useTestEnvironment</code>{" "}
        off. Test builds don&apos;t open production links.
      </Hint>
      <div className="mb-4 max-w-[560px]">
        <FieldLabel htmlFor="onb-link-name">Name</FieldLabel>
        <SetupInput
          id="onb-link-name"
          tone="plain"
          mono={false}
          value={name}
          onChange={setName}
          placeholder="Summer sale"
          readOnly={!!link}
          className="text-sm"
        />
      </div>
      {(!link || rows.length > 0) && (
        <div className="mb-4 max-w-[560px]">
          <FieldLabel>
            Data{" "}
            <span className="ml-1 font-normal text-muted-foreground">
              optional
            </span>
          </FieldLabel>
          {rows.map((row, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2">
              <SetupInput
                aria-label={`Key ${i + 1}`}
                tone="plain"
                value={row.key}
                onChange={(key) =>
                  setRows((r) => r.map((x, j) => (j === i ? { ...x, key } : x)))
                }
                placeholder="promo"
                readOnly={!!link}
              />
              <SetupInput
                aria-label={`Value ${i + 1}`}
                tone="plain"
                value={row.value}
                onChange={(value) =>
                  setRows((r) =>
                    r.map((x, j) => (j === i ? { ...x, value } : x))
                  )
                }
                placeholder="SUMMER20"
                readOnly={!!link}
              />
              {!link && (
                <QuietButton
                  type="button"
                  aria-label={`Remove ${row.key || "row"}`}
                  className="size-10 p-0"
                  onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </QuietButton>
              )}
            </div>
          ))}
          {!link && (
            <button
              type="button"
              onClick={() => setRows((r) => [...r, { key: "", value: "" }])}
              className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3.5" />
              Add data
            </button>
          )}
          <Hint>Your app receives these when the link opens it.</Hint>
        </div>
      )}

      {link ? (
        <>
          <FieldLabel>Link</FieldLabel>
          <LinkBox url={link.url} />
          {opened ? (
            <div className="mt-[22px] flex max-w-[560px] items-center gap-3.5 rounded-xl border border-valid-green/30 bg-valid-green/[0.05] px-[18px] py-4">
              <OkMark className="size-8 [&_svg]:size-4" label="Opened" />
              <div>
                <b className="block text-[15px] font-semibold">
                  It opened {projectName}
                </b>
                <span className="text-[13px] text-muted-foreground">
                  {describeOpen(opened)}
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-[22px] max-w-[560px] text-[13.5px]">
              <div className="grid grid-cols-[22px_1fr_auto] items-center gap-2.5 border-t border-border py-3">
                <OkMark />
                Link created
                <span className="text-[12.5px] text-muted-foreground">
                  just now
                </span>
              </div>
              <div className="grid grid-cols-[22px_1fr_auto] items-center gap-2.5 border-y border-border py-3">
                <Spinner />
                Waiting for someone to open it
                <span className="text-[12.5px] text-muted-foreground">
                  optional
                </span>
              </div>
            </div>
          )}
          <Hint className="max-w-[560px]">
            {opened ? (
              "Every link you create works the same way. You can edit this one in Links."
            ) : (
              <>
                Not opening the app?{" "}
                <a
                  href={docsUrl("/docs/sdk/ios/quick-start")}
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground underline decoration-foreground/25 underline-offset-[3px]"
                >
                  Troubleshoot
                </a>
                . You can finish now either way.
              </>
            )}
          </Hint>
        </>
      ) : (
        <div className="max-w-[560px]">
          <OutlineButton
            onClick={createLink}
            disabled={create.isPending}
            className="mt-1 h-9 rounded-lg px-4 text-sm"
          >
            Create link
          </OutlineButton>
          {error && <ErrorText>{error}</ErrorText>}
          <Hint>You can finish without one and make links later.</Hint>
        </div>
      )}
    </>
  );

  const right = (
    <div className="flex flex-col items-center gap-3">
      <PanelCaption>
        {opened ? "Opened on your phone" : "Scan with your phone"}
      </PanelCaption>
      <div
        className={cn(
          "rounded-2xl border border-border bg-background p-[18px]",
          opened && "border-valid-green/35",
          !link && "opacity-40"
        )}
      >
        <QRCodeSVG
          value={link?.url ?? "https://grovs.io"}
          size={180}
          bgColor="transparent"
          fgColor={dark ? "#E6E8EB" : "#0A0A0A"}
          level="M"
        />
      </div>
      <span className="block max-w-[260px] text-center text-[13px] text-foreground/75">
        {link ? stripScheme(link.url) : "Your link's QR code"}
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {opened
            ? "Recorded as your first link open"
            : link
              ? `Opens ${projectName} if installed, otherwise the store`
              : "Appears once the link is made"}
        </span>
      </span>
    </div>
  );

  return (
    <StepPage
      left={left}
      right={right}
      footer={
        <>
          {link && !opened && phoneMail && (
            <a
              href={phoneMail}
              className="text-[13.5px] underline decoration-foreground/25 underline-offset-[3px] hover:decoration-foreground/60"
            >
              Send to my phone
            </a>
          )}
          <FooterSpacer />
          <QuietButton onClick={onBack} className="hidden sm:inline-flex">
            Back
          </QuietButton>
          <PrimaryButton onClick={onFinish}>Finish</PrimaryButton>
        </>
      }
    />
  );
};
