"use client";
import type { AccessorKeyColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { recipientsLabel, segmentLabel } from "@ee/lib/audience";
import { canCancel, awaitingWinner, formatScheduledAt } from "@ee/lib/push";
import { usePushRowActions } from "@ee/context/usePushRowActionsContext";
import PushStatusPill from "./PushStatusPill";
import type { PushCampaign } from "@ee/types/push";

const header = (label: string) => (
  <Button variant="ghost" tabIndex={-1}>
    {label}
  </Button>
);
const number = (value: number) => value.toLocaleString();

function AudienceCell({
  campaign,
  segmentNames,
}: {
  campaign: PushCampaign;
  segmentNames: Map<string, string>;
}) {
  const { audience } = campaign;
  if (audience.type === "segment")
    return (
      <span>
        {segmentLabel(
          audience.segment_id ? segmentNames.get(audience.segment_id) : null
        )}
      </span>
    );
  return (
    <span>{recipientsLabel(audience.type, audience.recipients_count)}</span>
  );
}

function WhenCell({ campaign }: { campaign: PushCampaign }) {
  const past =
    campaign.finished_at ??
    (campaign.status === "draft" ? campaign.created_at : null);
  const text =
    campaign.status === "scheduled"
      ? formatScheduledAt(campaign, "short")
      : past && format(new Date(past), "MMM d, yyyy HH:mm");
  if (!text) return <span className="text-muted-foreground">—</span>;
  return <span className="text-muted-foreground">{text}</span>;
}

function ReachCell({ campaign }: { campaign: PushCampaign }) {
  const { report } = campaign;
  return (
    <span className="tabular-nums">
      {number(report.targeted)} → {number(report.delivered)}
      {report.opened > 0 && (
        <span className="text-muted-foreground">
          {" "}
          · opened {number(report.opened)}
        </span>
      )}
    </span>
  );
}

function RowMenu({ campaign }: { campaign: PushCampaign }) {
  const actions = usePushRowActions();
  if (!actions) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${campaign.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => actions.onOpen(campaign)}>
          Open
        </DropdownMenuItem>
        {campaign.status === "draft" && (
          <DropdownMenuItem onSelect={() => actions.onEdit(campaign)}>
            Edit
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => actions.onDuplicate(campaign)}>
          Duplicate
        </DropdownMenuItem>
        {canCancel(campaign) && (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => actions.onCancel(campaign)}
          >
            Cancel
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function getPushCampaignsTableColumns(
  segmentNames: Map<string, string>
): AccessorKeyColumnDef<PushCampaign>[] {
  const columns: AccessorKeyColumnDef<PushCampaign>[] = [
    {
      accessorKey: "name",
      header: () => header("Name"),
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {row.original.title}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: () => header("Status"),
      cell: ({ row }) => (
        <PushStatusPill
          status={row.original.status}
          waiting={awaitingWinner(row.original)}
        />
      ),
    },
    {
      accessorKey: "audience",
      header: () => header("Audience"),
      cell: ({ row }) => (
        <AudienceCell campaign={row.original} segmentNames={segmentNames} />
      ),
    },
    {
      accessorKey: "scheduled_at",
      header: () => header("When"),
      cell: ({ row }) => <WhenCell campaign={row.original} />,
    },
    {
      accessorKey: "report",
      header: () => header("Reach"),
      cell: ({ row }) => <ReachCell campaign={row.original} />,
    },
  ];
  columns.push({
    accessorKey: "id",
    header: () => null,
    cell: ({ row }) => <RowMenu campaign={row.original} />,
  });
  return columns;
}
