"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import ActionConfirm from "@/components/common/action-confirm";
import { useUrlState } from "@/hooks/useUrlState";
import { Choice } from "@/components/composer/fields";
import JourneysTable from "@ee/components/journeys/JourneysTable";
import JourneyDialog from "@ee/components/journeys/JourneyDialog";
import TemplateChooser from "@ee/components/journeys/TemplateChooser";
import { useSaveJourney } from "@ee/hooks/mutations/useJourneyMutations";
import { showErrorNotification } from "@/lib/Notifications";
import type { JourneyTemplate } from "@ee/lib/journeyTemplates";
import { useJourneysQuery } from "@ee/hooks/queries/useJourneyQueries";
import { useJourneyActions } from "@ee/hooks/useJourneyActions";
import {
  isJourneyStatus,
  isJourneysNotEnabled,
  journeyErrorText,
  journeyInput,
  journeyStatusLabel,
} from "@ee/lib/journeys";
import PushShell, { type PushContext } from "@ee/app/push/PushShell";
import { JOURNEY_STATUSES, type JourneyStatus } from "@ee/types/journey";

const STATUS_OPTIONS: { label: string; value: JourneyStatus | "all" }[] = [
  { label: "All", value: "all" },
  ...JOURNEY_STATUSES.map((value) => ({
    label: journeyStatusLabel(value),
    value,
  })),
];

function Workspace({ projectId }: PushContext) {
  const router = useRouter();
  const [status, setStatus] = useUrlState<JourneyStatus | "all">(
    "status",
    "all",
    { parse: (v) => (isJourneyStatus(v) ? v : "all") }
  );
  const query = useJourneysQuery(projectId, status);
  const [choosing, setChoosing] = useState(false);
  const [editing, setEditing] = useState<{
    open: boolean;
    id: string | null;
    fresh?: boolean;
  }>({ open: false, id: null });
  const openBuilder = (id: string, fresh = false) =>
    setEditing({ open: true, id, fresh });
  const create = useSaveJourney(projectId);
  const [creating, setCreating] = useState<string | null>(null);
  // The draft is made first, so the editor always works on a saved journey.
  const start = async (template: JourneyTemplate) => {
    setCreating(template.id);
    try {
      const journey = await create.mutateAsync({
        id: null,
        input: journeyInput(template.draft()),
      });
      setChoosing(false);
      openBuilder(journey.id, true);
    } catch (error) {
      showErrorNotification(
        journeyErrorText(error, "Could not create the journey.")
      );
    } finally {
      setCreating(null);
    }
  };
  const actions = useJourneyActions(projectId, openBuilder);

  if (isJourneysNotEnabled(query.error))
    return (
      <p className="text-sm text-muted-foreground">
        Journeys are not enabled for this project.
      </p>
    );

  const journeys = (query.data?.pages ?? []).flatMap((p) => p.journeys);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Choice
          label="Status"
          className="w-[190px]"
          value={status}
          options={STATUS_OPTIONS}
          onChange={setStatus}
        />
        <Button onClick={() => setChoosing(true)}>
          <Plus className="size-4" />
          New journey
        </Button>
      </div>
      {query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {journeyErrorText(query.error, "Could not load journeys.")}
        </p>
      ) : (
        <JourneysTable
          journeys={journeys}
          loading={query.isPending}
          hasFilters={status !== "all"}
          hasMore={query.hasNextPage}
          loadingMore={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
          onCreate={() => setChoosing(true)}
          actions={{
            onOpen: (j) =>
              j.status === "draft"
                ? openBuilder(j.id)
                : router.push(`/journeys/${j.id}`),
            onEdit: (j) => openBuilder(j.id),
            onDuplicate: (j) => void actions.duplicate(j),
            onStep: actions.step,
            onDelete: actions.requestDelete,
          }}
        />
      )}
      <TemplateChooser
        open={choosing}
        onOpenChange={setChoosing}
        busy={creating}
        onChoose={(t) => void start(t)}
      />
      <JourneyDialog
        open={editing.open}
        onOpenChange={(open) => setEditing((e) => ({ ...e, open }))}
        projectId={projectId}
        journeyId={editing.id}
        fresh={editing.fresh}
      />
      <ActionConfirm {...actions.confirm} />
    </div>
  );
}

export default function JourneysPage() {
  return (
    <PushShell title="Journeys" noun="journeys">
      {(ctx) => <Workspace {...ctx} />}
    </PushShell>
  );
}
