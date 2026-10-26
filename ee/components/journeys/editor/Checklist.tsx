"use client";
import { CalendarClock, Flag, Route, Zap, type LucideIcon } from "lucide-react";
import { stepLabel, stepOrder, type JourneyProblems } from "@ee/lib/journeys";
import type { JourneyInput } from "@ee/types/journey";
import { GOALS, SETTINGS } from "../JourneyMap";
import { STEP_ICONS } from "../stepIcons";

export interface CheckItem {
  text: string;
  // The card to select: the entry, the goals, a step; null is the overview.
  target: string | null;
  icon: LucideIcon;
}

export function checklist(
  draft: JourneyInput,
  found: JourneyProblems
): CheckItem[] {
  return [
    ...found.entry.map((text) => ({ text, target: SETTINGS, icon: Zap })),
    ...found.map.map((text) => ({ text, target: null, icon: Route })),
    ...stepOrder(draft).flatMap((id) =>
      (found.steps[id] ?? []).map((text) => ({
        text: `${stepLabel(draft, id)}: ${text}`,
        target: id,
        icon: STEP_ICONS[draft.steps[id]!.type],
      }))
    ),
    ...found.goals.map((text) => ({ text, target: GOALS, icon: Flag })),
    ...found.overview.map((text) => ({
      text,
      target: null,
      icon: CalendarClock,
    })),
  ];
}

export default function Checklist({
  items,
  onGo,
}: {
  items: CheckItem[];
  onGo: (item: CheckItem) => void;
}) {
  if (!items.length) return null;
  return (
    <ul className="divide-y divide-sidebar-border overflow-hidden rounded-lg border border-sidebar-border">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={`${item.target}:${item.text}`}>
            <button
              type="button"
              onClick={() => onGo(item)}
              className="flex w-full items-start gap-2.5 bg-background px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-muted/60"
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Icon className="size-3" />
              </span>
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                {item.text}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
