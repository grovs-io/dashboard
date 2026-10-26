"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Download,
  ListChecks,
  Plus,
  Star,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  quickQuestionDraft,
  rateDraft,
  updateDraft,
  type InAppDraft,
} from "@ee/lib/inAppComposer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import ActionConfirm from "@/components/common/action-confirm";
import { useUrlState } from "@/hooks/useUrlState";
import {
  inAppErrorText,
  inAppStatusLabel,
  isInAppNotEnabled,
  isInAppStatus,
} from "@ee/lib/inApp";
import { useSegmentsQuery } from "@ee/hooks/queries/useSegmentsQueries";
import {
  useInAppCampaignsQuery,
  useInAppPlatforms,
  useInAppSettingsQuery,
} from "@ee/hooks/queries/useInAppQueries";
import InAppOnboarding from "@ee/components/in_app/InAppOnboarding";
import { useInAppCampaignActions } from "@ee/hooks/useInAppCampaignActions";
import InAppCampaignDialog from "@ee/components/in_app/InAppCampaignDialog";
import InAppCampaignsTable from "@ee/components/in_app/InAppCampaignsTable";
import PushShell, { type PushContext } from "@ee/app/push/PushShell";
import { IN_APP_STATUSES, type InAppStatus } from "@ee/types/inApp";

const PRESETS = [
  {
    title: "Ask people to update",
    hint: "For people on an old version of the app",
    icon: Download,
    draft: updateDraft,
  },
  {
    title: "Rate the app",
    hint: "Five stars, then an optional store review",
    icon: Star,
    draft: rateDraft,
  },
  {
    title: "Quick question",
    hint: "People pick one answer from a list",
    icon: ListChecks,
    draft: quickQuestionDraft,
  },
];

function StartItem({
  title,
  hint,
  icon: Icon,
  onSelect,
}: {
  title: string;
  hint: string;
  icon: LucideIcon;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem className="gap-3 px-2 py-2" onSelect={onSelect}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent">
        <Icon className="size-4 text-primary" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium leading-tight">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {hint}
        </span>
      </span>
    </DropdownMenuItem>
  );
}

const STATUS_OPTIONS: { label: string; value: InAppStatus | "all" }[] = [
  { label: "All", value: "all" },
  ...IN_APP_STATUSES.map((value) => ({
    label: inAppStatusLabel(value),
    value,
  })),
];

function Workspace({ projectId }: PushContext) {
  const router = useRouter();
  const [status, setStatus] = useUrlState<InAppStatus | "all">(
    "status",
    "all",
    {
      parse: (v) => (isInAppStatus(v) ? v : "all"),
    }
  );
  const query = useInAppCampaignsQuery(projectId, status);
  const settings = useInAppSettingsQuery(projectId);
  const platforms = useInAppPlatforms(query.isSuccess);
  const segments = useSegmentsQuery(projectId, false);
  const [composer, setComposer] = useState<{
    open: boolean;
    id: string | null;
    preset?: InAppDraft;
  }>({ open: false, id: null });
  const openComposer = (id: string | null, preset?: InAppDraft) =>
    setComposer({ open: true, id, preset });
  const actions = useInAppCampaignActions(projectId, openComposer);

  const segmentNames = useMemo(
    () => new Map((segments.data?.segments ?? []).map((s) => [s.id, s.name])),
    [segments.data]
  );

  if (isInAppNotEnabled(query.error))
    return (
      <p className="text-sm text-muted-foreground">
        In-app messages are not enabled for this project.
      </p>
    );

  const campaigns = (query.data?.pages ?? []).flatMap(
    (p) => p.in_app_campaigns
  );
  const noCampaigns =
    query.isSuccess && status === "all" && campaigns.length === 0;
  const nothingSetUp =
    !!platforms && !platforms.ios && !platforms.android && !platforms.web;
  if (nothingSetUp && noCampaigns) return <InAppOnboarding />;
  // Holds the skeleton so the empty state doesn't flash before the onboarding.
  const awaitingSetup = noCampaigns && platforms === undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as InAppStatus | "all")}
        >
          <SelectTrigger className="w-[190px]" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                New message
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-1.5">
              <StartItem
                title="Blank message"
                hint="Write it yourself, step by step"
                icon={Plus}
                onSelect={() => openComposer(null)}
              />
              <DropdownMenuSeparator className="-mx-1.5 my-1.5" />
              <DropdownMenuLabel className="pb-1 pt-1 text-xs font-medium text-muted-foreground">
                Start from a template
              </DropdownMenuLabel>
              {PRESETS.map((preset) => (
                <StartItem
                  key={preset.title}
                  title={preset.title}
                  hint={preset.hint}
                  icon={preset.icon}
                  onSelect={() => openComposer(null, preset.draft())}
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {settings.data && !settings.data.enabled && (
        <p
          role="status"
          className="rounded-md border border-sidebar-border bg-muted/50 p-3 text-[13px]"
        >
          In-app messages are switched off for this project, so no device shows
          any. Switch them on in{" "}
          <Link
            href="/engagement_settings"
            className="font-medium text-primary hover:underline"
          >
            Engagement Settings
          </Link>
          .
        </p>
      )}
      {query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {inAppErrorText(query.error, "Could not load in-app messages.")}
        </p>
      ) : (
        <InAppCampaignsTable
          campaigns={campaigns}
          loading={query.isPending || awaitingSetup}
          hasFilters={status !== "all"}
          hasMore={query.hasNextPage}
          loadingMore={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
          segmentNames={segmentNames}
          onCreate={() => openComposer(null)}
          actions={{
            onOpen: (c) =>
              c.status === "draft"
                ? openComposer(c.id)
                : router.push(`/in_app/${c.id}`),
            onEdit: (c) => openComposer(c.id),
            onDuplicate: (c) => void actions.duplicate(c),
            onStep: actions.step,
            onDelete: actions.requestDelete,
          }}
        />
      )}
      <InAppCampaignDialog
        open={composer.open}
        onOpenChange={(open) => setComposer((c) => ({ ...c, open }))}
        projectId={projectId}
        campaignId={composer.id}
        preset={composer.preset}
      />
      <ActionConfirm {...actions.confirm} />
    </div>
  );
}

export default function InAppCampaignsPage() {
  return (
    <PushShell title="In-App" noun="in-app messages">
      {(ctx) => <Workspace {...ctx} />}
    </PushShell>
  );
}
