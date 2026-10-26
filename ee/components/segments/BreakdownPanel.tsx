"use client";
import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  CircleDashed,
  Globe,
  Megaphone,
  Tag,
  UserRound,
} from "lucide-react";
import { PlatformIcon } from "@/components/analytics/shared";
import { cn } from "@/lib/utils";
import { valueLabel } from "@ee/lib/segmentLabels";
import { useMemo } from "react";
import { useRecoverExpiredResult } from "@ee/hooks/useRecoverExpiredResult";
import { ApiError } from "@/lib/ApiError";
import Link from "next/link";
import { useAnalyticsEventFieldsQuery } from "@/hooks/queries/useAnalyticsEventsQueries";
import { useSegmentCatalogueQuery } from "@ee/hooks/queries/useSegmentsQueries";
import { catalogueEntry } from "@ee/lib/segments";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSegmentBreakdownQuery } from "@ee/hooks/queries/useSegmentsQueries";
import { BREAKDOWN_DIMENSIONS } from "@ee/types/segments";
import { SegmentError } from "./SegmentNotices";

const flag = (code: string) =>
  /^[A-Z]{2}$/i.test(code)
    ? String.fromCodePoint(
        ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
      )
    : null;

function BucketIcon({ by, value }: { by: string; value: string }) {
  const tail = value === "other" || value === "unknown";
  const wrap =
    "flex size-[18px] shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground";
  if (tail)
    return (
      <span className={wrap}>
        <CircleDashed className="size-3" />
      </span>
    );
  switch (by) {
    case "platform":
      return (
        <span className={wrap}>
          <PlatformIcon platform={value} alt="" size={12} />
        </span>
      );
    case "country": {
      const f = flag(value);
      return f ? (
        <span className="w-[18px] text-center text-[15px] leading-none">
          {f}
        </span>
      ) : (
        <span className={wrap}>
          <Globe className="size-3" />
        </span>
      );
    }
    case "app_version":
      return (
        <span className={wrap}>
          <Tag className="size-3" />
        </span>
      );
    case "source":
    case "campaign":
      return (
        <span className={wrap}>
          <Megaphone className="size-3" />
        </span>
      );
    case "first_seen_week":
      return (
        <span className={wrap}>
          <CalendarDays className="size-3" />
        </span>
      );
    default:
      return (
        <span className={wrap}>
          <UserRound className="size-3" />
        </span>
      );
  }
}

function bucketLabel(by: string, b: { value: string; label: string }) {
  if (b.value === "other") return "Other";
  if (b.value === "unknown") return "Unknown";
  if (by === "platform" || by === "country") return valueLabel(by, b.value);
  if (by === "first_seen_week" && /^\d{4}-\d{2}-\d{2}$/.test(b.value))
    return `Week of ${format(parseISO(b.value), "MMM d, yyyy")}`;
  return b.label || b.value;
}

const labels: Record<string, string> = {
  platform: "Platform",
  country: "Country",
  app_version: "App version",
  source: "Install source (UTM)",
  campaign: "Install campaign",
  first_seen_week: "First seen (week)",
  property: "Profile property",
};

export const dimensionHint: Record<string, string> = {
  platform: "The platform of each person's current device.",
  country: "The country of each person's current device.",
  app_version: "The app version each person last used.",
  source:
    "The utm_source on the link that drove each person's install. People who installed without a tracked link show as Unknown.",
  campaign:
    "The campaign of the link that drove each person's install. Click a campaign to open it.",
  first_seen_week: "The week each person was first seen.",
  property: "The value of one profile property your app set on each person.",
};

export interface BreakdownDimension {
  choice: string;
  property: string;
}

export const defaultBreakdownDimension: BreakdownDimension = {
  choice: "platform",
  property: "",
};

const OTHER = "property:other";

export function BreakdownDimensionPicker({
  projectId,
  value,
  onChange,
}: {
  projectId: string;
  value: BreakdownDimension;
  onChange: (v: BreakdownDimension) => void;
}) {
  const catalogue = useSegmentCatalogueQuery(projectId);
  const fields = useAnalyticsEventFieldsQuery(projectId);
  const keys = useMemo(() => {
    const seen = new Set<string>(
      catalogueEntry(catalogue.data, "profile")?.property_keys ?? []
    );
    for (const f of fields.data?.fields ?? [])
      if (f.type === "user_attribute") seen.add(f.name.replace(/^user\./, ""));
    return [...seen].sort();
  }, [catalogue.data, fields.data]);
  const isProperty = value.choice === "property";
  const known =
    isProperty && value.property !== "" && keys.includes(value.property);
  const selected = isProperty
    ? known
      ? `properties.${value.property}`
      : OTHER
    : value.choice;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {selected === OTHER && (
        <Input
          className="h-8 w-32"
          placeholder="property key"
          aria-label="Profile property key"
          value={value.property}
          onChange={(e) =>
            onChange({ choice: "property", property: e.target.value.trim() })
          }
        />
      )}
      <Select
        value={selected}
        onValueChange={(v) => {
          if (v === OTHER) onChange({ choice: "property", property: "" });
          else if (v.startsWith("properties."))
            onChange({
              choice: "property",
              property: v.slice("properties.".length),
            });
          else onChange({ choice: v, property: "" });
        }}
      >
        <SelectTrigger
          size="sm"
          className="h-8 w-44"
          aria-label="Breakdown dimension"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Dimension</SelectLabel>
            {BREAKDOWN_DIMENSIONS.map((d) => (
              <SelectItem key={d} value={d}>
                {labels[d]}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Profile property</SelectLabel>
            {keys.map((k) => (
              <SelectItem key={k} value={`properties.${k}`}>
                {k}
              </SelectItem>
            ))}
            <SelectItem value={OTHER}>Other property…</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export default function BreakdownPanel({
  projectId,
  segmentId,
  resultId,
  dimension,
  onExpired,
  computing = false,
}: {
  projectId: string;
  segmentId: string;
  resultId: string | undefined;
  dimension: BreakdownDimension;
  onExpired?: () => void;
  computing?: boolean;
}) {
  const { choice, property } = dimension;
  const by =
    choice === "property" ? (property ? `properties.${property}` : "") : choice;
  const query = useSegmentBreakdownQuery(projectId, segmentId, by, resultId);
  const expired = query.error instanceof ApiError && query.error.status === 410;
  const { recovering, reload } = useRecoverExpiredResult(
    expired,
    resultId,
    computing,
    onExpired
  );
  const rows = query.data
    ? [...query.data.buckets].sort((a, b) => {
        const tail = (v: string) =>
          v === "other" ? 1 : v === "unknown" ? 2 : 0;
        return tail(a.value) - tail(b.value);
      })
    : [];
  const total = query.data?.total_persons ?? 0;
  const max = Math.max(...rows.map((b) => b.persons), 1);
  if (choice === "property" && !property)
    return (
      <p className="text-xs text-muted-foreground">
        Pick a profile property above to split the segment by its values.
      </p>
    );
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{dimensionHint[choice]}</p>
      {query.isError && !recovering && (
        <SegmentError
          error={query.error}
          fallback={
            expired
              ? "This result has expired."
              : "Could not compute the breakdown."
          }
          onRetry={expired ? reload : () => void query.refetch()}
        />
      )}
      {(query.isPending || recovering) && by && resultId ? (
        <div className="flex flex-col gap-3.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-full rounded" />
          ))}
        </div>
      ) : rows.length > 0 ? (
        <ul className="flex flex-col gap-3.5">
          {rows.map((b) => {
            const tail = b.value === "other" || b.value === "unknown";
            const share = total ? (b.persons / total) * 100 : 0;
            return (
              <li key={b.value} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2.5 text-[12.5px]">
                  {choice === "campaign" && !tail ? (
                    <Link
                      href={`/dynamic_links/campaigns/${b.value}`}
                      className="flex min-w-0 items-center gap-2 hover:text-[var(--chart-users)] hover:underline"
                    >
                      <BucketIcon by={choice} value={b.value} />
                      <span className="truncate">{bucketLabel(choice, b)}</span>
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        "flex min-w-0 items-center gap-2",
                        tail && "text-muted-foreground"
                      )}
                    >
                      <BucketIcon by={choice} value={b.value} />
                      <span className="truncate">{bucketLabel(choice, b)}</span>
                    </span>
                  )}
                  <span className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
                    <span className="font-semibold">
                      {b.persons.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {total ? `${share.toFixed(1)}%` : "—"}
                    </span>
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      tail
                        ? "bg-muted-foreground/40"
                        : "bg-[var(--chart-users)]"
                    )}
                    style={{
                      width: `${Math.max(2, (b.persons / max) * 100)}%`,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        query.isSuccess && (
          <p className="text-xs text-muted-foreground">
            No values for this dimension.
          </p>
        )
      )}
    </div>
  );
}
