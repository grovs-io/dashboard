"use client";
import { useId, type ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, Loader2 } from "lucide-react";
import { PlatformIcon } from "@/components/analytics/shared";
import { Button } from "@/components/ui/button";

export interface SetupPlatform {
  key: string;
  label: string;
  needs: string;
  href?: string;
  /** Replaces the platform logo, for rows that aren't a platform. */
  icon?: ReactNode;
  /** Button text; defaults to "Set up <label>". */
  actionLabel?: string;
  /** Runs instead of following `href`. */
  onAction?: () => void;
  /** Shows a waiting pill instead of the button. */
  waiting?: string;
}

function RowAction({ p, noun }: { p: SetupPlatform; noun: string }) {
  if (p.waiting)
    return (
      <span className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-muted px-3.5 text-sm font-medium sm:w-auto">
        <Loader2 className="size-4 text-[var(--chart-users)] motion-safe:animate-spin" />
        {p.waiting}
      </span>
    );
  const label = p.actionLabel ?? `Set up ${p.label}`;
  const inner = (
    <>
      {label}
      <ArrowRight className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5" />
    </>
  );
  if (p.onAction)
    return (
      <Button
        type="button"
        className="group w-full sm:w-auto"
        onClick={p.onAction}
      >
        {inner}
      </Button>
    );
  const external = p.href?.startsWith("http");
  return (
    <Button asChild className="group w-full sm:w-auto">
      <Link
        href={p.href ?? "#"}
        aria-label={p.actionLabel ? undefined : `Set up ${p.label} ${noun}`}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {inner}
      </Link>
    </Button>
  );
}

// Shared "nothing set up yet" panel for Push, In-App and Home: what to connect, and what users will see.
export default function PlatformSetupPanel({
  title,
  description,
  platforms,
  noun,
  preview,
}: {
  title: string;
  description: string;
  platforms: readonly SetupPlatform[];
  noun: string;
  preview: ReactNode;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="grid overflow-hidden rounded-xl border border-sidebar-border bg-card md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"
    >
      <div className="flex flex-col justify-center gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>

        <ul className="flex flex-col gap-2.5">
          {platforms.map((p) => (
            <li
              key={p.key}
              className="flex flex-wrap items-center gap-4 rounded-lg border border-sidebar-border bg-background p-3.5 transition-colors hover:border-primary/40"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                {p.icon ?? <PlatformIcon platform={p.key} alt="" size={22} />}
              </span>
              <div className="min-w-48 flex-1">
                <p className="text-sm font-semibold">{p.label}</p>
                <p className="text-xs text-muted-foreground">{p.needs}</p>
              </div>
              <RowAction p={p} noun={noun} />
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-sidebar-border md:border-t-0 md:border-l">
        {preview}
      </div>
    </section>
  );
}

// A phone cropped by the panel's bottom edge; children render on its screen.
export function PhonePreview({
  lockScreen,
  children,
}: {
  lockScreen?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden
      className="relative flex h-full min-h-72 justify-center overflow-hidden bg-muted/40 px-6 pt-8 [background-image:radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:14px_14px] dark:bg-muted/20"
    >
      <div className="relative h-full w-64 overflow-hidden rounded-t-[2.25rem] border-x-[6px] border-t-[6px] border-foreground/10 bg-background px-3 pt-5 pb-8 shadow-xl">
        <div className="mx-auto mb-5 h-1.5 w-16 rounded-full bg-foreground/10" />
        {lockScreen && (
          <>
            <p className="text-center text-[11px] font-medium text-muted-foreground">
              {format(new Date(), "EEEE, d MMMM")}
            </p>
            <p className="mb-5 text-center text-4xl font-light tracking-tight tabular-nums">
              9:41
            </p>
          </>
        )}
        {children}
      </div>
    </div>
  );
}
