"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  PUSH_STATUSES,
  isPushNotEnabled,
  isPushStatus,
  pushErrorText,
  statusLabel,
} from "@ee/lib/push";
import { useSegmentsQuery } from "@ee/hooks/queries/useSegmentsQueries";
import {
  usePushCampaignsQuery,
  usePushChannels,
} from "@ee/hooks/queries/usePushQueries";
import { usePushCampaignActions } from "@ee/hooks/usePushCampaignActions";
import PushCampaignDialog from "@ee/components/push/PushCampaignDialog";
import PushCampaignsTable from "@ee/components/push/PushCampaignsTable";
import PushOnboarding from "@ee/components/push/PushOnboarding";
import PushSetupNotice from "@ee/components/push/PushSetupNotice";
import PushUnavailableNotice from "@ee/components/push/PushUnavailableNotice";
import type { PushStatus } from "@ee/types/push";
import PushShell, { type PushContext } from "./PushShell";

const STATUS_OPTIONS: { label: string; value: PushStatus | "all" }[] = [
  { label: "All", value: "all" },
  ...PUSH_STATUSES.map((value) => ({ label: statusLabel(value), value })),
];

function PushWorkspace({ projectId }: PushContext) {
  const router = useRouter();
  const [status, setStatus] = useUrlState<PushStatus | "all">("status", "all", {
    parse: (v) => (isPushStatus(v) ? v : "all"),
  });
  const query = usePushCampaignsQuery(projectId, status);
  const segments = useSegmentsQuery(projectId, false);
  const [composer, setComposer] = useState<{
    open: boolean;
    id: string | null;
  }>({
    open: false,
    id: null,
  });
  const openComposer = (id: string | null) => setComposer({ open: true, id });
  const actions = usePushCampaignActions(projectId, openComposer);
  const channels = usePushChannels(query.isSuccess);

  const segmentNames = useMemo(
    () => new Map((segments.data?.segments ?? []).map((s) => [s.id, s.name])),
    [segments.data]
  );

  if (isPushNotEnabled(query.error)) return <PushUnavailableNotice />;

  const pages = query.data?.pages ?? [];
  const campaigns = pages.flatMap((p) => p.push_campaigns);
  // An older backend cuts the list at 200 with no cursor to continue from.
  const cutOff = !query.hasNextPage && (pages.at(-1)?.truncated ?? false);
  const nothingSetUp = !!channels && !channels.ios && !channels.android;
  const noCampaigns =
    query.isSuccess && status === "all" && campaigns.length === 0;
  const onboarding = nothingSetUp && noCampaigns;
  if (onboarding) return <PushOnboarding />;
  // Holds the skeleton so the empty state doesn't flash before the onboarding.
  const awaitingSetup = noCampaigns && channels === undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as PushStatus | "all")}
        >
          <SelectTrigger className="w-[160px]">
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
        {!nothingSetUp && (
          <Button onClick={() => openComposer(null)}>New campaign</Button>
        )}
      </div>
      <PushSetupNotice channels={channels} />
      {query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {pushErrorText(query.error, "Could not load push campaigns.")}
        </p>
      ) : (
        <PushCampaignsTable
          campaigns={campaigns}
          loading={query.isPending || awaitingSetup}
          hasFilters={status !== "all"}
          truncated={cutOff}
          hasMore={query.hasNextPage}
          loadingMore={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
          segmentNames={segmentNames}
          onCreate={nothingSetUp ? undefined : () => openComposer(null)}
          actions={{
            onOpen: (c) =>
              c.status === "draft"
                ? openComposer(c.id)
                : router.push(`/push/${c.id}`),
            onEdit: (c) => openComposer(c.id),
            onDuplicate: (c) => void actions.duplicate(c),
            onCancel: actions.requestCancel,
          }}
        />
      )}
      <PushCampaignDialog
        open={composer.open}
        onOpenChange={(open) => setComposer((c) => ({ ...c, open }))}
        projectId={projectId}
        campaignId={composer.id}
      />
      <ActionConfirm {...actions.cancelConfirm} />
    </div>
  );
}

export default function PushCampaignsPage() {
  return (
    <PushShell title="Push">{(ctx) => <PushWorkspace {...ctx} />}</PushShell>
  );
}
