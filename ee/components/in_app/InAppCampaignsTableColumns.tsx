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
import { segmentLabel } from "@ee/lib/audience";
import {
  TEMPLATES,
  canEdit,
  canEnd,
  canPause,
  canResume,
  triggerLabel,
} from "@ee/lib/inApp";
import { useInAppRowActions } from "@ee/context/useInAppRowActionsContext";
import type { InAppCampaign } from "@ee/types/inApp";
import InAppStatusPill from "./InAppStatusPill";

const header = (label: string) => (
  <Button variant="ghost" tabIndex={-1}>
    {label}
  </Button>
);

function when(campaign: InAppCampaign): string {
  const at =
    campaign.ended_at ??
    (campaign.status === "scheduled" ? campaign.start_at : null) ??
    campaign.launched_at ??
    campaign.created_at;
  return format(new Date(at), "MMM d, yyyy HH:mm");
}

function RowMenu({ campaign }: { campaign: InAppCampaign }) {
  const actions = useInAppRowActions();
  if (!actions) return null;
  const draft = campaign.status === "draft";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${campaign.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {!draft && (
          <DropdownMenuItem onSelect={() => actions.onOpen(campaign)}>
            Open report
          </DropdownMenuItem>
        )}
        {canEdit(campaign) && (
          <DropdownMenuItem onSelect={() => actions.onEdit(campaign)}>
            Edit
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => actions.onDuplicate(campaign)}>
          Duplicate
        </DropdownMenuItem>
        {canPause(campaign) && (
          <DropdownMenuItem onSelect={() => actions.onStep(campaign, "pause")}>
            Pause
          </DropdownMenuItem>
        )}
        {canResume(campaign) && (
          <DropdownMenuItem onSelect={() => actions.onStep(campaign, "resume")}>
            Resume
          </DropdownMenuItem>
        )}
        {canEnd(campaign) && (
          <DropdownMenuItem onSelect={() => actions.onStep(campaign, "end")}>
            End
          </DropdownMenuItem>
        )}
        {draft && (
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => actions.onDelete(campaign)}
          >
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function getInAppCampaignsTableColumns(
  segmentNames: Map<string, string>
): AccessorKeyColumnDef<InAppCampaign>[] {
  return [
    {
      accessorKey: "name",
      header: () => header("Name"),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "status",
      header: () => header("Status"),
      cell: ({ row }) => <InAppStatusPill status={row.original.status} />,
    },
    {
      accessorKey: "template",
      header: () => header("Template"),
      cell: ({ row }) => TEMPLATES[row.original.template]?.label ?? "—",
    },
    {
      accessorKey: "triggers",
      header: () => header("Shows when"),
      cell: ({ row }) => {
        const [first, ...rest] = row.original.triggers;
        if (!first) return <span className="text-muted-foreground">—</span>;
        return (
          <span>
            {triggerLabel(first)}
            {rest.length > 0 && (
              <span className="text-muted-foreground"> +{rest.length}</span>
            )}
          </span>
        );
      },
    },
    {
      accessorKey: "audience",
      header: () => header("Audience"),
      cell: ({ row }) => {
        const { audience } = row.original;
        return audience.type === "segment"
          ? segmentLabel(
              audience.segment_id ? segmentNames.get(audience.segment_id) : null
            )
          : "Everyone";
      },
    },
    {
      accessorKey: "updated_at",
      header: () => header("When"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{when(row.original)}</span>
      ),
    },
    {
      accessorKey: "id",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <RowMenu campaign={row.original} />,
    },
  ];
}
