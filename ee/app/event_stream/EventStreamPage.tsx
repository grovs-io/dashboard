"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Tabs from "@radix-ui/react-tabs";
import AppHeader from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectSelection } from "@/context/useProjectSelection";
import { useUserContext } from "@/context/useUserContext";
import { useSubscriptionQuery } from "@/hooks/queries/usePaymentsQueries";
import { useIsInstanceAdmin } from "@/hooks/useIsInstanceAdmin";
import { IS_ENTERPRISE, IS_SELF_HOSTED } from "@/lib/edition";
import { TEST } from "@/constants/OptionsConstants";
import { ApiError } from "@/lib/ApiError";
import { queryKeys } from "@/lib/queryKeys";
import type { AnalyticsRetention } from "@/types/instance";
import {
  useEventDestinations,
  useFeedTokens,
} from "@ee/hooks/queries/useEventStreamQueries";
import { useEventStreamActions } from "@ee/hooks/mutations/useEventStreamActions";
import { streamError } from "@ee/lib/eventStream";
import EventStreamAccess from "@ee/components/event-stream/EventStreamAccess";
import DestinationsSection from "@ee/components/event-stream/DestinationsSection";
import PullFeedSection from "@ee/components/event-stream/PullFeedSection";
import ExportsSection from "@ee/components/event-stream/ExportsSection";
import { StreamError } from "@ee/components/event-stream/StreamUi";
import { BodySkeleton } from "@/components/common/PageSkeleton";

function PageLayout({
  children,
  showHeader = true,
}: {
  children: ReactNode;
  showHeader?: boolean;
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {showHeader && <AppHeader titleOverride="Data Export" />}
      <div className="flex-1 overflow-auto p-4 sm:p-6">{children}</div>
    </div>
  );
}

function StreamWorkspace({
  projectId,
  instanceId,
  admin,
  retention,
}: {
  projectId: string;
  instanceId: string;
  admin: boolean;
  retention?: AnalyticsRetention;
}) {
  const destinations = useEventDestinations(projectId);
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(
    null
  );
  const client = useQueryClient();
  const { fetchCurrentUser } = useUserContext();
  const [accessStatus, setAccessStatus] = useState<number>();
  const onAccessError = useCallback(
    (status: number) => {
      setAccessStatus(status);
      void client.invalidateQueries({
        queryKey: queryKeys.payments.subscription(instanceId),
      });
      void fetchCurrentUser().catch(() => {});
    },
    [client, instanceId, fetchCurrentUser]
  );
  const actions = useEventStreamActions(projectId, onAccessError);
  const canManage = admin && accessStatus !== 403;
  const feedTokens = useFeedTokens(
    projectId,
    canManage && !!destinations.data && !destinations.error
  );
  const queryStatus =
    destinations.error instanceof ApiError
      ? destinations.error.status
      : undefined;
  useEffect(() => {
    if (queryStatus !== 402 && queryStatus !== 403) return;
    // The query already supplies the access state for rendering. Only refresh
    // external entitlement/identity here; do not mirror it into local state.
    void client.invalidateQueries({
      queryKey: queryKeys.payments.subscription(instanceId),
    });
    void fetchCurrentUser().catch(() => {});
  }, [queryStatus, client, instanceId, fetchCurrentUser]);
  const retryAccess = async () => {
    await Promise.allSettled([
      fetchCurrentUser(),
      client.invalidateQueries({
        queryKey: queryKeys.payments.subscription(instanceId),
      }),
    ]);
    const result = await destinations.refetch();
    if (!result.error) setAccessStatus(undefined);
  };
  const accessUnavailable = accessStatus === 402 || queryStatus === 402;
  let content;
  if (accessUnavailable)
    content = (
      <EventStreamAccess
        onRetry={() => {
          void retryAccess();
        }}
        pending={destinations.isFetching}
      />
    );
  else if (queryStatus === 403)
    content = (
      <div className="space-y-3">
        <StreamError message="You no longer have access to this project's destinations. Select another project or contact an instance admin." />
        <Button
          variant="outline"
          disabled={destinations.isFetching}
          onClick={() => {
            void retryAccess();
          }}
        >
          Retry access
        </Button>
      </div>
    );
  else if (destinations.isPending)
    content = (
      <div
        role="status"
        aria-label="Loading event stream"
        className="space-y-4"
      >
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  else if (!destinations.data)
    content = (
      <div className="space-y-3">
        <StreamError message={streamError(destinations.error)} />
        <Button
          variant="outline"
          onClick={() => {
            void destinations.refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  else
    content = (
      <div className="space-y-6">
        {destinations.error && (
          <StreamError
            message={`Delivery health may be stale. ${streamError(destinations.error)}`}
          />
        )}
        {accessStatus === 403 && (
          <p role="status" className="text-sm text-muted-foreground">
            Management access was refused. You can still inspect destinations;
            ask an instance admin to make changes.
          </p>
        )}
        {accessStatus === 403 && (
          <Button
            variant="outline"
            disabled={destinations.isFetching}
            onClick={() => {
              void retryAccess();
            }}
          >
            Retry access
          </Button>
        )}
        {actions.reconciliationRequired && (
          <div
            role="status"
            className="space-y-2 rounded-md border p-3 text-sm"
          >
            <p>
              A create request may have succeeded. Refresh the lists before
              creating anything else, then check for the connection or token you
              requested.
            </p>
            <Button
              variant="outline"
              disabled={actions.pending}
              onClick={() => {
                void actions.recover();
              }}
            >
              Refresh lists
            </Button>
          </div>
        )}
        <Tabs.Root
          key={String(canManage)}
          defaultValue="destinations"
          className="space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-sidebar-border">
            <Tabs.List
              aria-label="Event Stream navigation"
              className="flex self-stretch gap-4 sm:gap-6"
            >
              {[
                {
                  value: "destinations",
                  label: "Destinations",
                  count: destinations.data.length,
                },
                {
                  value: "feed",
                  label: "Pull feed tokens",
                  count:
                    canManage && !feedTokens.error
                      ? feedTokens.data?.length
                      : undefined,
                },
                { value: "exports", label: "Exports" },
              ].map((tab) => (
                <Tabs.Trigger
                  key={tab.value}
                  value={tab.value}
                  className="-mb-px flex items-center gap-2 border-b-2 border-transparent px-0 pb-3 pt-1 text-sm whitespace-nowrap font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:border-primary data-[state=active]:text-primary"
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span
                      aria-hidden="true"
                      className="rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground"
                    >
                      {tab.count}
                    </span>
                  )}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <div
              ref={setToolbarTarget}
              role="group"
              aria-label="Event Stream actions"
              className="flex min-h-12 w-56 shrink-0 items-center justify-end gap-2 pb-3 max-sm:ml-auto"
            />
          </div>
          <Tabs.Content value="destinations" className="outline-none">
            <DestinationsSection
              toolbarTarget={toolbarTarget}
              projectId={projectId}
              destinations={destinations.data}
              admin={canManage}
              actions={actions}
              refreshing={destinations.isFetching}
              onRefresh={() => {
                void destinations.refetch();
              }}
            />
          </Tabs.Content>
          <Tabs.Content value="feed" className="outline-none">
            <PullFeedSection
              toolbarTarget={toolbarTarget}
              projectId={projectId}
              admin={canManage}
              actions={actions}
              onAccessError={onAccessError}
            />
          </Tabs.Content>
          <Tabs.Content value="exports" className="outline-none">
            <ExportsSection
              projectId={projectId}
              destinations={destinations.data}
              admin={canManage}
              retention={retention}
              actions={actions}
            />
          </Tabs.Content>
        </Tabs.Root>
      </div>
    );
  return <PageLayout showHeader={!accessUnavailable}>{content}</PageLayout>;
}

function EnterprisePage() {
  const { selectedInstance, projectType } = useProjectSelection();
  const subscription = useSubscriptionQuery(selectedInstance?.id);
  const billingSubscription = subscription.data?.subscription;
  // Matches backend event_stream_enabled?: self-hosted, Enterprise, or an active paid Stripe plan.
  const hasAccess =
    !!subscription.data?.isEnterprise ||
    (!!billingSubscription &&
      !billingSubscription.payment_issue &&
      billingSubscription.details?.active === true);
  const admin = useIsInstanceAdmin();
  // Derive from the instance and environment atomically. selectedProject is
  // synchronized by ClientLayout in an effect and briefly belongs to the old
  // selection after a switch.
  const project =
    projectType === TEST
      ? selectedInstance?.test
      : selectedInstance?.production;
  let body;
  // No instance only while projects load; users without one get the create-project dialog.
  if (!selectedInstance || !project) body = <BodySkeleton />;
  else if (!IS_SELF_HOSTED && subscription.isPending)
    body = <p role="status">Checking enterprise access…</p>;
  else if (!IS_SELF_HOSTED && subscription.isError)
    body = (
      <div className="space-y-3">
        <StreamError message="Could not check enterprise access." />
        <Button
          variant="outline"
          onClick={() => {
            void subscription.refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  else if (!IS_SELF_HOSTED && !hasAccess)
    return (
      <PageLayout showHeader={false}>
        <EventStreamAccess
          onRetry={() => {
            void subscription.refetch();
          }}
          pending={subscription.isFetching}
        />
      </PageLayout>
    );
  else
    return (
      <StreamWorkspace
        key={`${selectedInstance.id}:${projectType}:${project.id}:${admin}`}
        projectId={project.id}
        instanceId={selectedInstance.id}
        admin={admin}
        retention={selectedInstance.analytics_retention}
      />
    );
  return <PageLayout>{body}</PageLayout>;
}
export default function EventStreamPage() {
  return IS_ENTERPRISE ? (
    <EnterprisePage />
  ) : (
    <p>Data Export is unavailable in this edition.</p>
  );
}
