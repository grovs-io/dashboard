"use client";
import Link from "next/link";
import {
  CornerDownRight,
  ExternalLink,
  Plus,
  Flag,
  Users,
  Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  MAX_STEPS,
  STEP_HINTS,
  STEP_LABELS,
  STEP_TYPES,
  continueTargets,
  entryLabel,
  goalsLabel,
  layout,
  stepLabel,
  stepSummary,
  type Anchor,
  type JourneyProblems,
  type LayoutLink,
  type LayoutNode,
} from "@ee/lib/journeys";
import type { JourneyInput, JourneyReport, StepType } from "@ee/types/journey";
import { STEP_ICONS } from "./stepIcons";

export const SETTINGS = "settings";
export const GOALS = "goals";

interface Props {
  draft: JourneyInput;
  segmentName: (id: string) => string | null;
  selected?: string | null;
  onSelect?: (id: string) => void;
  // Set while the steps may still change: the "+" on every link.
  onInsert?: (anchor: Anchor, type: StepType) => void;
  onContinue?: (anchor: Anchor, target: string) => void;
  problems?: JourneyProblems;
  // The report's counts; the map is read-only with them.
  report?: JourneyReport;
  // The editor's first row: "Starts when…" beside "Leaves when…".
  editor?: boolean;
}

const LINE = "w-px bg-muted-foreground/30";
const count = (n: number | undefined) => (n ?? 0).toLocaleString();

function where(draft: JourneyInput, link: LayoutLink) {
  if (link.anchor.from === null) return "at the start";
  const label = link.label ? ` on ${link.label}` : "";
  return `after ${stepLabel(draft, link.anchor.from)}${label}`;
}

function AddMenu({
  draft,
  link,
  onInsert,
  onContinue,
}: {
  draft: JourneyInput;
  link: LayoutLink;
  onInsert: NonNullable<Props["onInsert"]>;
  onContinue?: Props["onContinue"];
}) {
  const full = Object.keys(draft.steps).length >= MAX_STEPS;
  // Only a path end may join another step.
  const targets =
    link.target === null ? continueTargets(draft, link.anchor) : [];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Add a step ${where(draft, link)}`}
          className="flex size-6 items-center justify-center rounded-full border border-sidebar-border bg-background text-muted-foreground shadow-xs transition-colors hover:border-primary hover:text-primary data-[state=open]:border-primary data-[state=open]:bg-primary data-[state=open]:text-white"
        >
          <Plus className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-72 p-1.5">
        {STEP_TYPES.map((type) => {
          const Icon = STEP_ICONS[type];
          return (
            <DropdownMenuItem
              key={type}
              disabled={full}
              className="gap-3 px-2 py-2"
              onSelect={() => onInsert(link.anchor, type)}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent">
                <Icon className="size-4 text-primary" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium leading-tight">
                  {STEP_LABELS[type]}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {STEP_HINTS[type]}
                </span>
              </span>
            </DropdownMenuItem>
          );
        })}
        {onContinue && link.target === null && link.anchor.from !== null && (
          <>
            <DropdownMenuSeparator className="-mx-1.5 my-1.5" />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                disabled={targets.length === 0}
                className="gap-3 px-2 py-2"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <CornerDownRight className="size-4 text-muted-foreground" />
                </span>
                <span className="text-[13px] font-medium">Continue at…</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                {targets.map((id) => (
                  <DropdownMenuItem
                    key={id}
                    onSelect={() => onContinue(link.anchor, id)}
                  >
                    {stepLabel(draft, id)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Dot({ problems }: { problems: string[] }) {
  return (
    <span
      title={problems.join("\n")}
      aria-label={`${problems.length} to fix: ${problems.join(" ")}`}
      className="ml-auto size-2 shrink-0 rounded-full bg-destructive ring-2 ring-destructive/15"
    />
  );
}

function Card({
  id,
  label,
  icon,
  summary,
  selected,
  problems,
  onSelect,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  summary: string;
  selected: boolean;
  problems: string[];
  onSelect?: () => void;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <span className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
          {icon}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {problems.length > 0 && <Dot problems={problems} />}
      </span>
      <span className="mt-1.5 block truncate text-[13px] font-medium">
        {summary}
      </span>
    </>
  );
  const box = cn(
    "block w-64 rounded-lg border bg-background p-3 text-left shadow-xs transition-colors",
    selected
      ? "border-primary ring-2 ring-primary/30"
      : "border-sidebar-border",
    onSelect && !selected && "hover:border-primary/50"
  );
  if (!onSelect)
    return (
      <div className={box} aria-label={label} data-step-id={id}>
        {body}
        {children}
      </div>
    );
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      data-step-id={id}
      className={box}
      onClick={onSelect}
    >
      {body}
      {children}
    </button>
  );
}

function Counts({ reached, now }: { reached: number; now: number }) {
  return (
    <span className="mt-2 flex gap-3 text-xs text-muted-foreground">
      <span>
        Reached{" "}
        <span className="font-semibold tabular-nums text-foreground">
          {count(reached)}
        </span>
      </span>
      <span>
        Now{" "}
        <span className="font-semibold tabular-nums text-foreground">
          {count(now)}
        </span>
      </span>
    </span>
  );
}

function LinkView({ link, ...props }: Props & { link: LayoutLink }) {
  const { draft, onInsert, onContinue, onSelect, report } = props;
  const branch =
    report && link.anchor.from
      ? report.steps[link.anchor.from]?.branches[link.anchor.key]
      : undefined;
  return (
    <div className="flex flex-col items-center">
      {link.label && (
        <span className="mb-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {link.label}
          {report && ` · ${count(branch)}`}
        </span>
      )}
      <div className={cn(LINE, "h-4")} />
      {onInsert && (
        <>
          <AddMenu
            draft={draft}
            link={link}
            onInsert={onInsert}
            onContinue={onContinue}
          />
          <div className={cn(LINE, "h-4")} />
        </>
      )}
      {link.node ? (
        <NodeView {...props} node={link.node} />
      ) : link.join ? (
        <button
          type="button"
          disabled={!onSelect}
          onClick={() => onSelect?.(link.join!)}
          className="flex items-center gap-1.5 rounded-full border border-dashed border-sidebar-border bg-background px-2.5 py-1 text-xs text-muted-foreground enabled:hover:text-foreground"
        >
          <CornerDownRight className="size-3.5" />
          Continues at: {stepLabel(draft, link.join)}
        </button>
      ) : (
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          <span className="size-2 rounded-full border border-muted-foreground/50" />
          End
        </span>
      )}
    </div>
  );
}

function NodeView({ node, ...props }: Props & { node: LayoutNode }) {
  const { draft, selected, onSelect, problems, report, segmentName } = props;
  const step = draft.steps[node.id]!;
  const Icon = STEP_ICONS[step.type];
  const counts = report?.steps[node.id];
  const channel =
    step.type === "push" || step.type === "in_app" ? step.campaign_id : null;
  return (
    <div className="flex flex-col items-center">
      <Card
        id={node.id}
        label={stepLabel(draft, node.id)}
        icon={<Icon className="size-3.5" />}
        summary={stepSummary(draft, step, segmentName)}
        selected={selected === node.id}
        problems={problems?.steps[node.id] ?? []}
        onSelect={onSelect && (() => onSelect(node.id))}
      >
        {report && (
          <>
            <Counts reached={counts?.reached ?? 0} now={counts?.now ?? 0} />
            {channel && (
              <Link
                href={`/${step.type}/${channel}`}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {step.type === "push" ? "Push report" : "In-app report"}
                <ExternalLink className="size-3" />
              </Link>
            )}
          </>
        )}
      </Card>
      {node.links.length === 1 ? (
        <LinkView {...props} link={node.links[0]!} />
      ) : (
        <>
          <div className={cn(LINE, "h-4")} />
          <div className="flex items-start">
            {node.links.map((link, i) => (
              <div
                key={link.anchor.key}
                className={cn(
                  "relative flex flex-col items-center px-4 pt-4 before:absolute before:top-0 before:h-px before:bg-muted-foreground/30 before:content-['']",
                  i === 0 ? "before:left-1/2" : "before:left-0",
                  i === node.links.length - 1
                    ? "before:right-1/2"
                    : "before:right-0"
                )}
              >
                <div className={cn(LINE, "absolute top-0 h-4")} />
                <LinkView {...props} link={link} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// The journey top-down: branches side by side, a join drawn once with a chip on its other parents.
const reEntryText: Record<string, string> = {
  once: "once ever",
  after_exit: "again after leaving",
};

// "Everyone · once ever": who may enter and whether they can come back.
export function entryHint(
  draft: JourneyInput,
  segmentName: (id: string) => string | null
): string {
  const who = draft.entry.audience_segment_id
    ? `Only ${segmentName(draft.entry.audience_segment_id) ?? "a segment"}`
    : "Everyone";
  const again =
    reEntryText[draft.re_entry.mode] ??
    `again after ${draft.re_entry.days ?? "?"} days`;
  return `${who} · ${again}`;
}

// The journey top-down: branches side by side, a join drawn once with a chip on its other parents.
export default function JourneyMap(props: Props) {
  const { draft, selected, onSelect, problems, report, segmentName, editor } =
    props;
  const segment = draft.entry.type === "segment";
  const entryProblems = problems?.entry ?? [];
  const entry = (
    <Card
      id={SETTINGS}
      label={editor ? "Starts when…" : "Entry"}
      icon={
        segment ? <Users className="size-3.5" /> : <Zap className="size-3.5" />
      }
      summary={entryLabel(draft.entry, segmentName)}
      selected={selected === SETTINGS}
      problems={entryProblems}
      onSelect={onSelect && (() => onSelect(SETTINGS))}
    >
      <span className="mt-1 block truncate text-xs text-muted-foreground">
        {editor ? entryHint(draft, segmentName) : `Goals: ${goalsLabel(draft)}`}
      </span>
      {report && (
        <span className="mt-2 block text-xs text-muted-foreground">
          Entered{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {count(report.entered)}
          </span>
        </span>
      )}
    </Card>
  );
  return (
    <div className="mx-auto flex w-max min-w-full flex-col items-center px-8 py-6">
      <div data-map-content className="flex w-max flex-col items-center">
        {editor ? (
          <div className="flex items-start gap-6">
            {entry}
            <Card
              id={GOALS}
              label="Leaves when…"
              icon={<Flag className="size-3.5" />}
              summary={
                draft.goals.length ? goalsLabel(draft) : "No goal — add one"
              }
              selected={selected === GOALS}
              problems={problems?.goals ?? []}
              onSelect={onSelect && (() => onSelect(GOALS))}
            >
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {draft.goals.length
                  ? "Counts as converted, from any step"
                  : "Without a goal, people leave at the end"}
              </span>
            </Card>
          </div>
        ) : (
          entry
        )}
        {/* The goals card's width on the right keeps the flow under "Starts when…". */}
        <div className={editor ? "pr-[17.5rem]" : undefined}>
          <LinkView {...props} link={layout(draft)} />
        </div>
      </div>
    </div>
  );
}
