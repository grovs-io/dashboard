"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Star } from "lucide-react";
import { PlatformIcon } from "@/components/analytics/shared";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import ReportCard from "@ee/components/push/ReportCard";
import { useInAppCommentsQuery } from "@ee/hooks/queries/useInAppQueries";
import type { InAppAnswers } from "@ee/types/inApp";

const PLATFORMS: Record<string, string> = {
  ios: "iOS",
  android: "Android",
  web: "Web",
};

const STARS_ROW = "grid-cols-[78px_minmax(0,1fr)]";
const CHOICE_ROW = "sm:grid-cols-[132px_minmax(0,1fr)]";
const ROW = "grid gap-x-4 gap-y-1.5 py-3";
// As tall as a list that scrolls, so the card does not grow when the comments arrive.
export const WAITING_LIST =
  "h-[320px] divide-y divide-sidebar-border overflow-hidden";

export const starsText = (value: number | string) =>
  `${value} star${Number(value) === 1 ? "" : "s"}`;

// The answers a filter keeps: all of them, a range of stars, or one answer.
const FILTERS: Record<string, string[] | undefined> = {
  all: undefined,
  low: ["1", "2", "3"],
  high: ["4", "5"],
};
const kept = (filter: string) =>
  filter in FILTERS ? FILTERS[filter] : [filter.slice(3)];

function Stars({ value, small }: { value: number; small?: boolean }) {
  return (
    <span
      role="img"
      aria-label={starsText(value)}
      className={cn("flex gap-0.5", !small && "pt-0.5")}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          data-filled={n <= value}
          className={cn(
            small ? "size-3" : "size-3.5",
            n <= value
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/50"
          )}
        />
      ))}
    </span>
  );
}

// Comments that are on their way, in the shape of the ones that follow.
export function CommentSkeletons({
  count,
  stars,
}: {
  count: number;
  stars: boolean;
}) {
  return Array.from({ length: count }, (_, i) => (
    <li
      key={`waiting-${i}`}
      aria-hidden="true"
      className={cn(ROW, stars ? STARS_ROW : CHOICE_ROW)}
    >
      <Skeleton className={stars ? "mt-0.5 h-3.5 w-[78px]" : "h-5 w-20"} />
      <div className="flex flex-col gap-1">
        <Skeleton className="my-[2.5px] h-3.5 w-full" />
        <Skeleton className="my-[2.5px] h-3.5 w-2/3" />
        <Skeleton className="my-0.5 h-3 w-32" />
      </div>
    </li>
  ));
}

export default function InAppComments({
  projectId,
  campaignId,
  period,
  answers,
}: {
  projectId: string;
  campaignId: string;
  period: { from: string; to: string };
  answers: Pick<InAppAnswers, "type" | "values">;
}) {
  const [filter, setFilter] = useState("all");
  const { type, values } = answers;
  const starred = type === "stars";
  const query = useInAppCommentsQuery(projectId, campaignId, {
    ...period,
    values: kept(filter)?.join(","),
  });
  const {
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = query;
  const pages = query.data?.pages ?? [];
  const comments = pages.flatMap((page) => page.comments);

  const area = useRef<HTMLDivElement | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);
  // A page that failed is asked for again by hand, never by the scroll.
  const more = hasNextPage && !isFetchingNextPage && !isFetchNextPageError;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchNextPage();
      },
      { root: area.current, rootMargin: "80px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [more, fetchNextPage, comments.length]);

  const labels = new Map(values.map((v) => [String(v.value), v.label]));
  // The id stands in for an option that is no longer in the list.
  const label = (value: number | string) =>
    starred ? starsText(value) : (labels.get(String(value)) ?? String(value));
  const total = (value: string) => {
    const keep = kept(value);
    return values
      .filter((v) => !keep || keep.includes(String(v.value)))
      .reduce((sum, v) => sum + (v.comments ?? 0), 0);
  };
  const options = [
    ...(starred
      ? [
          {
            label: "By rating",
            items: [
              { value: "low", label: "1 to 3 stars" },
              { value: "high", label: "4 and 5 stars" },
            ],
          },
        ]
      : []),
    {
      label: starred ? "By stars" : "By answer",
      items: (starred ? [...values].reverse() : values).map((v) => ({
        value: `is:${v.value}`,
        label: label(v.value),
        stars: starred ? Number(v.value) : undefined,
      })),
    },
  ];
  const chosen =
    options.flatMap((g) => g.items).find((o) => o.value === filter)?.label ??
    "All comments";
  const item = (option: { value: string; label: string; stars?: number }) => (
    <SelectItem
      key={option.value}
      value={option.value}
      disabled={total(option.value) === 0 && option.value !== "all"}
      className="*:[span]:last:w-full"
    >
      {option.stars !== undefined && <Stars value={option.stars} small />}
      {option.label}
      <span className="ml-auto pl-4 tabular-nums text-muted-foreground">
        {total(option.value).toLocaleString()}
      </span>
    </SelectItem>
  );
  const failed = (text: string, again: () => void) => (
    <div role="alert" className="flex items-center gap-3 py-3 text-[13px]">
      <span className="text-muted-foreground">{text}</span>
      <Button type="button" variant="outline" size="sm" onClick={again}>
        Try again
      </Button>
    </div>
  );

  return (
    <ReportCard
      title={
        <>
          Comments{" "}
          <span className="font-normal tabular-nums text-muted-foreground">
            {total(filter).toLocaleString()}
          </span>
        </>
      }
      aside={
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger
            aria-label="Comments for"
            className="w-full sm:w-[180px]"
          >
            <SelectValue>{chosen}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end" className="min-w-[250px]">
            {item({ value: "all", label: "All comments" })}
            {options.map((group) => (
              <Fragment key={group.label}>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.items.map(item)}
                </SelectGroup>
              </Fragment>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {query.isPending ? (
        <ul
          aria-busy="true"
          aria-label="Loading comments"
          className={WAITING_LIST}
        >
          <CommentSkeletons count={4} stars={starred} />
        </ul>
      ) : pages.length === 0 ? (
        failed("Could not load the comments.", () => void query.refetch())
      ) : comments.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          {filter === "all"
            ? "No comments yet."
            : "No comments for this answer."}
        </p>
      ) : (
        <div
          ref={area}
          data-testid="in-app-comments"
          className="-mr-2 max-h-[320px] overflow-y-auto pr-2"
        >
          <ul className="divide-y divide-sidebar-border">
            {comments.map((c, i) => (
              <li
                key={`${c.at}-${i}`}
                className={cn(ROW, starred ? STARS_ROW : CHOICE_ROW)}
              >
                {starred ? (
                  <Stars value={Number(c.value)} />
                ) : (
                  <span
                    title={label(c.value)}
                    className="h-fit w-fit max-w-full truncate rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
                  >
                    {label(c.value)}
                  </span>
                )}
                <div className="min-w-0 space-y-1">
                  <p className="whitespace-pre-line text-sm leading-snug [overflow-wrap:anywhere]">
                    {c.comment}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <PlatformIcon platform={c.platform} size={12} alt="" />
                    {PLATFORMS[c.platform] ?? c.platform}
                    <span aria-hidden="true">·</span>
                    <time
                      dateTime={c.at}
                      title={format(new Date(c.at), "d MMM yyyy, HH:mm")}
                    >
                      {formatDistanceToNowStrict(new Date(c.at), {
                        addSuffix: true,
                      })}
                    </time>
                  </p>
                </div>
              </li>
            ))}
            {isFetchingNextPage && (
              <CommentSkeletons count={3} stars={starred} />
            )}
          </ul>
          {isFetchNextPageError &&
            !isFetchingNextPage &&
            failed("Could not load more comments.", () => void fetchNextPage())}
          {!hasNextPage && pages.length > 1 && (
            <p className="py-3 text-center text-xs text-muted-foreground">
              That is all of them.
            </p>
          )}
          <div ref={sentinel} className="h-px" />
        </div>
      )}
    </ReportCard>
  );
}
