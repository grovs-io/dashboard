"use client";
import { useState, type ReactNode } from "react";
import NextLink from "next/link";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGlobalLinkDialog } from "@/context/useLinkDialogContext";
import { useProjectSelection } from "@/context/useProjectSelection";
import { useLinksByIdsQuery } from "@/hooks/queries/useLinksQueries";
import { handleCopyText } from "@/lib/copyTextHelper";
import { formatPropertyValue } from "@/components/analytics/events/EventJson";
import { useSegmentsQuery } from "@ee/hooks/queries/useSegmentsQueries";
import { recipientsLabel, segmentLabel } from "@ee/lib/audience";
import { formatScheduledAt, soundLabel } from "@ee/lib/push";
import { cn } from "@/lib/utils";
import type { VariantKey } from "@ee/lib/inAppComposer";
import type { PushCampaign } from "@ee/types/push";
import NotificationPreview, {
  PreviewPlatformToggle,
  type PreviewPlatform,
} from "./composer/NotificationPreview";
import ReportCard from "./ReportCard";

// Label left, value right, like the rows in the dashboard's and Segments' panels.
function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-[13px]">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-col items-end text-right">{children}</dd>
    </div>
  );
}

const None = ({ label = "None" }: { label?: string }) => (
  <span className="text-muted-foreground">{label}</span>
);

export default function ContentSummary({
  projectId,
  campaign,
}: {
  projectId: string;
  campaign: PushCampaign;
}) {
  const { selectedProject } = useProjectSelection();
  const [platform, setPlatform] = useState<PreviewPlatform>("ios");
  // Which variant the preview draws; A is the campaign's own title and body.
  const [variant, setVariant] = useState<VariantKey>("a");
  const variants = campaign.variants ?? [];
  const versions = [
    { id: "a" as const, title: campaign.title, body: campaign.body },
    ...variants,
  ];
  const shown = versions.find((v) => v.id === variant) ?? versions[0]!;
  const { openEditLinkDialog } = useGlobalLinkDialog();
  const ids = campaign.link_id != null ? [String(campaign.link_id)] : null;
  const links = useLinksByIdsQuery(projectId, ids ? { ids } : null);
  const segments = useSegmentsQuery(projectId, false);
  // link_id is the raw numeric id the links API returns, not the hashid form.
  const link = links.data?.find(
    (l) => String(l.id) === String(campaign.link_id)
  );
  const dataEntries = Object.entries(campaign.data ?? {});
  const image = campaign.image_url || campaign.image;
  const { audience } = campaign;
  const segmentName =
    audience.segment_id &&
    segments.data?.segments?.find((s) => s.id === audience.segment_id)?.name;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ReportCard
        title="Notification"
        className={cn("min-h-[220px]", variants.length > 0 && "lg:col-span-3")}
        aside={
          <PreviewPlatformToggle value={platform} onChange={setPlatform} />
        }
      >
        {variants.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div
              role="radiogroup"
              aria-label="Variant"
              className="flex flex-col gap-2"
            >
              {versions.map((v) => {
                const on = v.id === shown.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={v.id.toUpperCase()}
                    onClick={() => setVariant(v.id)}
                    className={cn(
                      "rounded-lg border p-3 text-left text-[13px] transition-colors",
                      on
                        ? "border-primary/40 bg-accent"
                        : "border-sidebar-border hover:bg-muted/60"
                    )}
                  >
                    <span className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                          on
                            ? "bg-primary text-white"
                            : "bg-accent text-primary"
                        )}
                      >
                        {v.id.toUpperCase()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {v.id === "a"
                          ? "Your message"
                          : `Variant ${v.id.toUpperCase()}`}
                      </span>
                      {campaign.winner === v.id && (
                        <span className="rounded-full bg-valid-green-light px-2 py-0.5 text-[11px] font-medium text-valid-green">
                          sent to the rest
                        </span>
                      )}
                    </span>
                    <span className="block font-medium">{v.title}</span>
                    <span className="line-clamp-3 block whitespace-pre-wrap text-muted-foreground">
                      {v.body}
                    </span>
                  </button>
                );
              })}
            </div>
            <NotificationPreview
              appName={selectedProject?.name ?? "Your app"}
              title={shown.title}
              body={shown.body}
              image={image}
              platform={platform}
            />
          </div>
        ) : (
          <NotificationPreview
            appName={selectedProject?.name ?? "Your app"}
            title={campaign.title}
            body={campaign.body}
            image={image}
            platform={platform}
          />
        )}
      </ReportCard>

      <ReportCard title="Targeting" className="min-h-[220px]">
        <dl className="-my-2.5 divide-y divide-sidebar-border">
          <Item label="Audience">
            {audience.type === "segment" ? (
              audience.segment_id ? (
                <NextLink
                  href={`/segments/${audience.segment_id}`}
                  className="font-medium text-chart-users hover:text-[var(--chart-users-hover)] hover:underline"
                >
                  {segmentLabel(segmentName)}
                </NextLink>
              ) : (
                segmentLabel(null)
              )
            ) : (
              recipientsLabel(audience.type, audience.recipients_count)
            )}
          </Item>
          <Item label="Schedule">
            {formatScheduledAt(campaign) ?? "Immediately"}
          </Item>
          <Item label="Sound">{soundLabel(campaign.sound)}</Item>
        </dl>
      </ReportCard>

      <ReportCard title="Payload" className="min-h-[220px]">
        <dl className="-my-2.5 divide-y divide-sidebar-border">
          <Item label="Deep link">
            {campaign.link_id == null ? (
              <None label="No link" />
            ) : (
              <>
                <button
                  type="button"
                  className="font-medium text-chart-users hover:text-[var(--chart-users-hover)] hover:underline"
                  onClick={() =>
                    openEditLinkDialog(
                      link ?? { id: String(campaign.link_id) },
                      {}
                    )
                  }
                >
                  {link?.name ?? `Link #${campaign.link_id}`}
                </button>
                {link?.access_path && (
                  <span className="flex max-w-full items-center gap-1">
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {link.access_path}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 shrink-0"
                      aria-label="Copy link URL"
                      onClick={() => handleCopyText(link.access_path!)}
                    >
                      <Copy className="size-3" />
                    </Button>
                  </span>
                )}
              </>
            )}
          </Item>
          <Item label="Image">
            {image ? (
              <a
                href={image}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open image"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt=""
                  className="size-10 rounded-md border border-sidebar-border object-cover"
                />
              </a>
            ) : (
              <None />
            )}
          </Item>
          <Item label="Custom data">
            {dataEntries.length === 0 ? (
              <None />
            ) : (
              <span className="tabular-nums">
                {dataEntries.length} {dataEntries.length === 1 ? "key" : "keys"}
              </span>
            )}
          </Item>
          {dataEntries.map(([key, value]) => {
            const display = formatPropertyValue(value);
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-4 py-2 font-mono text-xs"
              >
                <dt className="shrink-0 text-muted-foreground">{key}</dt>
                <dd title={display} className="min-w-0 truncate">
                  {display}
                </dd>
              </div>
            );
          })}
        </dl>
      </ReportCard>
    </div>
  );
}
