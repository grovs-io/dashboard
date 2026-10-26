"use client";
import { Fragment } from "react";
import {
  Download,
  Loader2,
  Plus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  JOURNEY_TEMPLATES,
  type JourneyTemplate,
} from "@ee/lib/journeyTemplates";
import type { JourneyInput, StepType } from "@ee/types/journey";
import { STEP_ICONS } from "./stepIcons";

interface Node {
  icon: LucideIcon;
  caption?: string;
  entry?: boolean;
}

const duration = (minutes: number) =>
  minutes % 1440 === 0
    ? `${minutes / 1440}d`
    : minutes % 60 === 0
      ? `${minutes / 60}h`
      : `${minutes}m`;

// The template's main path, from entry through each step's "not yet" branch.
function mapOf(draft: JourneyInput): Node[] {
  const { entry } = draft;
  const nodes: Node[] = [
    {
      entry: true,
      icon:
        entry.type === "segment"
          ? Users
          : entry.event?.system === "install"
            ? Download
            : Zap,
    },
  ];
  const seen = new Set<string>();
  let id = draft.first_step;
  while (id && !seen.has(id) && draft.steps[id]) {
    seen.add(id);
    const step = draft.steps[id]!;
    nodes.push({
      icon: STEP_ICONS[step.type as StepType],
      caption: step.type === "wait" ? duration(step.minutes) : undefined,
    });
    id =
      step.type === "wait"
        ? (step.timeout_next ?? step.next)
        : "next" in step
          ? (step.next as string | null)
          : null;
  }
  return nodes;
}

const MAPS = new Map(JOURNEY_TEMPLATES.map((t) => [t.id, mapOf(t.draft())]));

function MiniMap({ nodes, blank }: { nodes: Node[]; blank: boolean }) {
  return (
    <div
      aria-hidden
      className="flex h-16 items-center rounded-md bg-muted/50 px-3 [background-image:radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:10px_10px]"
    >
      {nodes.map((n, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="h-px w-3 shrink-0 bg-border" />}
          <span className="relative flex flex-col items-center">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-md border",
                n.entry
                  ? "rounded-full border-primary/40 bg-primary/10 text-primary"
                  : "border-sidebar-border bg-background text-muted-foreground"
              )}
            >
              <n.icon className="size-3.5" />
            </span>
            {n.caption && (
              <span className="absolute top-full mt-0.5 text-[10px] leading-none text-muted-foreground tabular-nums">
                {n.caption}
              </span>
            )}
          </span>
        </Fragment>
      ))}
      {blank && (
        <>
          <span className="h-px w-3 shrink-0 bg-border" />
          <span className="flex size-7 items-center justify-center rounded-md border border-dashed border-muted-foreground/40 text-muted-foreground">
            <Plus className="size-3.5" />
          </span>
        </>
      )}
    </div>
  );
}

// Where a new journey starts: empty, or one of a few ready-made maps.
export default function TemplateChooser({
  open,
  onOpenChange,
  onChoose,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (template: JourneyTemplate) => void;
  // The template being made into a draft right now.
  busy?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Start a journey</DialogTitle>
          <DialogDescription>
            Start empty, or from a map you can change before launch.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {JOURNEY_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={!!busy}
              aria-busy={busy === t.id}
              onClick={() => onChoose(t)}
              className="group relative flex min-w-0 flex-col gap-3 rounded-lg border border-sidebar-border p-2.5 text-left transition-colors enabled:hover:border-primary/50 enabled:hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              <MiniMap nodes={MAPS.get(t.id) ?? []} blank={t.id === "blank"} />
              <span className="min-w-0 px-0.5 pb-0.5">
                <span className="flex items-center gap-1.5 text-[13px] font-medium leading-tight">
                  {t.title}
                  {busy === t.id && (
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                  )}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {t.hint}
                </span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
