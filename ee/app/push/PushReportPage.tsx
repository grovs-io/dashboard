"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Ban, Copy, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ActionConfirm from "@/components/common/action-confirm";
import { SectionLabel } from "@/components/common/SectionLabel";
import { ApiError } from "@/lib/ApiError";
import {
  canCancel,
  awaitingWinner,
  formatScheduledAt,
  isPushNotEnabled,
  pushErrorText,
} from "@ee/lib/push";
import {
  usePushCampaignQuery,
  usePushChannels,
  useRefreshDeliveriesWhileSending,
} from "@ee/hooks/queries/usePushQueries";
import { useInAppSettingsQuery } from "@ee/hooks/queries/useInAppQueries";
import PushExperimentCard from "@ee/components/push/PushExperimentCard";
import PushWinnerBanner from "@ee/components/push/PushWinnerBanner";
import PushSetupNotice from "@ee/components/push/PushSetupNotice";
import { usePushCampaignActions } from "@ee/hooks/usePushCampaignActions";
import PushCampaignDialog from "@ee/components/push/PushCampaignDialog";
import PushStatusPill from "@ee/components/push/PushStatusPill";
import PushUnavailableNotice from "@ee/components/push/PushUnavailableNotice";
import ReachFunnel from "@ee/components/push/ReachFunnel";
import FailuresTable from "@ee/components/push/FailuresTable";
import ContentSummary from "@ee/components/push/ContentSummary";
import DeliveriesTable from "@ee/components/push/DeliveriesTable";
import PushShell, { type PushContext } from "./PushShell";

function ReportWorkspace({
  campaignId,
  projectId,
}: PushContext & { campaignId: string }) {
  const router = useRouter();
  const client = useQueryClient();
  const query = usePushCampaignQuery(projectId, campaignId);
  // A new status or winner means new groups: the experiment is asked again.
  const status = query.data?.status;
  const winner = query.data?.winner;
  useEffect(() => {
    if (!status) return;
    void client.invalidateQueries({
      queryKey: queryKeys.projects.pushExperiment(projectId, campaignId),
    });
  }, [client, projectId, campaignId, status, winner]);
  const [editing, setEditing] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const actions = usePushCampaignActions(projectId, (id) =>
    setEditing({ open: true, id })
  );
  useRefreshDeliveriesWhileSending(projectId, query.data);
  const hasNoApp = (query.data?.report.error_counts.no_app ?? 0) > 0;
  const channels = usePushChannels(hasNoApp);
  // The project-wide control group lives in the in-app settings.
  const settings = useInAppSettingsQuery(projectId);
  const [autoOpened, setAutoOpened] = useState(false);
  // A deep link or reload onto a draft lands straight in the composer.
  if (!autoOpened && query.data?.status === "draft") {
    setAutoOpened(true);
    setEditing({ open: true, id: campaignId });
  }

  if (query.isPending) return <ReportSkeleton />;

  if (query.isError) {
    if (isPushNotEnabled(query.error)) return <PushUnavailableNotice />;
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-destructive">
          {query.error instanceof ApiError && query.error.status === 404
            ? "This push campaign could not be found."
            : pushErrorText(query.error, "Could not load this push campaign.")}
        </p>
        <Button variant="outline" onClick={() => router.push("/push")}>
          Back to push campaigns
        </Button>
      </div>
    );
  }

  const campaign = query.data;
  // The server answers 422 for a campaign with nothing to compare.
  const experiment =
    campaign.control_group !== null ||
    campaign.conversion !== null ||
    (campaign.variants?.length ?? 0) > 0 ||
    (settings.data?.control_group ?? 0) > 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{campaign.name}</h2>
            <PushStatusPill
              status={campaign.status}
              waiting={awaitingWinner(campaign)}
            />
          </div>
          {campaign.status === "scheduled" && campaign.scheduled_at ? (
            <p className="text-[13px] text-muted-foreground">
              Scheduled for {formatScheduledAt(campaign)}
            </p>
          ) : (
            campaign.started_at && (
              <p className="text-[13px] text-muted-foreground">
                {awaitingWinner(campaign)
                  ? "Sent to the test share"
                  : `${campaign.status === "sent" ? "Sent" : "Started"} ${format(parseISO(campaign.started_at), "d MMM yyyy, HH:mm")}`}
              </p>
            )
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {campaign.status === "draft" && (
            <Button
              variant="outline"
              onClick={() => setEditing({ open: true, id: campaign.id })}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
          )}
          {canCancel(campaign) && (
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => actions.requestCancel(campaign)}
            >
              <Ban className="size-4" />
              Cancel
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => void actions.duplicate(campaign)}
          >
            <Copy className="size-4" />
            Duplicate
          </Button>
        </div>
      </div>

      <PushWinnerBanner projectId={projectId} campaign={campaign} />

      {hasNoApp && <PushSetupNotice channels={channels} />}

      <section aria-label="Reach">
        <ReachFunnel campaign={campaign} />
      </section>

      {experiment && (
        <PushExperimentCard projectId={projectId} campaign={campaign} />
      )}

      <ReportSection
        title="Content"
        description="What was sent, to whom and when"
      >
        <ContentSummary projectId={projectId} campaign={campaign} />
      </ReportSection>

      <ReportSection
        title="Delivery"
        description="Why devices missed it, and the status of every device"
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <FailuresTable errorCounts={campaign.report.error_counts} />
          <DeliveriesTable
            projectId={projectId}
            campaignId={campaign.id}
            className="xl:col-span-2"
          />
        </div>
      </ReportSection>

      <PushCampaignDialog
        open={editing.open}
        onOpenChange={(open) => setEditing((e) => ({ ...e, open }))}
        projectId={projectId}
        campaignId={editing.id}
      />
      <ActionConfirm {...actions.cancelConfirm} />
    </div>
  );
}

function ReportSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <SectionLabel>{title}</SectionLabel>
        <span className="text-[12.5px] text-muted-foreground">
          {description}
        </span>
      </div>
      {children}
    </section>
  );
}

// Same shape as the loaded report, so the page doesn't jump when it arrives.
function ReportSkeleton() {
  const sectionHeader = (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-56" />
    </div>
  );
  return (
    <div
      className="flex flex-col gap-8"
      aria-busy="true"
      aria-label="Loading push campaign"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="overflow-hidden rounded-xl border border-sidebar-border bg-background">
        <div className="flex flex-wrap gap-2.5 p-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              className="h-[62px] min-w-[150px] flex-1 rounded-[10px]"
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-sidebar-border px-5 py-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {sectionHeader}
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[220px] rounded-md" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {sectionHeader}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Skeleton className="h-[300px] rounded-md" />
          <Skeleton className="h-[300px] rounded-md xl:col-span-2" />
        </div>
      </div>
    </div>
  );
}

export default function PushReportPage({ campaignId }: { campaignId: string }) {
  return (
    <PushShell title="Details">
      {(ctx) => <ReportWorkspace {...ctx} campaignId={campaignId} />}
    </PushShell>
  );
}
