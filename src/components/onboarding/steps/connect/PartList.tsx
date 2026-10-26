"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CopiedContext, TextLink } from "../../primitives";

export interface GuidePart {
  key: string;
  title: string;
  summary?: string;
  body: ReactNode;
  help: ReactNode;
  done: boolean;
}

const PartNumber = ({
  n,
  state,
}: {
  n: number;
  state: "ok" | "cur" | "todo";
}) => (
  <span
    className={cn(
      "grid size-5 place-items-center rounded-full border-[1.5px] border-foreground/15 text-[11px] font-medium text-muted-foreground",
      state === "ok" && "border-valid-green bg-valid-green text-white",
      state === "cur" && "border-chart-users text-chart-users"
    )}
  >
    {state === "ok" ? <Check className="size-3 stroke-[3]" /> : n}
  </span>
);

/** Accordion of a platform's parts: done ones collapse to a summary, the open one shows its body. */
export const PartList = ({
  parts,
  open,
  onOpen,
  onSettle,
  collapsed,
  onExpand,
}: {
  parts: GuidePart[];
  open: number;
  onOpen: (index: number) => void;
  /** The user did something in a part (copied, filled a field) that counts as doing it. */
  onSettle: (index: number) => void;
  collapsed: boolean;
  onExpand: () => void;
}) => {
  if (collapsed) {
    return (
      <div className="flex max-w-[620px] items-center gap-2.5 py-[15px] text-[13.5px]">
        <PartNumber n={0} state="ok" />
        <b className="font-medium text-muted-foreground">Required setup done</b>
        <span className="ml-auto text-[12.5px] text-muted-foreground">
          {parts.length} of {parts.length} ·{" "}
          <TextLink onClick={onExpand}>Show</TextLink>
        </span>
      </div>
    );
  }
  return (
    // Rows and text keep the 620px column; code panels use the full width.
    <div>
      {parts.map((part, i) => {
        const isOpen = i === open;
        const state = part.done ? "ok" : isOpen ? "cur" : "todo";
        return (
          <section
            key={part.key}
            aria-label={part.title}
            className="[&:first-child>button]:border-t-0"
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => onOpen(i)}
              className="grid w-full max-w-[620px] grid-cols-[22px_1fr_auto] items-center gap-2.5 border-t border-border py-[15px] text-left text-[13.5px]"
            >
              <PartNumber n={i + 1} state={state} />
              <b
                className={cn(
                  "font-medium",
                  isOpen && "font-semibold",
                  state === "ok" && !isOpen && "text-muted-foreground"
                )}
              >
                {part.title}
              </b>
              <span className="truncate text-[12.5px] text-muted-foreground">
                {state === "ok" && !isOpen ? part.summary : ""}
              </span>
            </button>
            {isOpen && (
              <div
                className="pb-5 text-[13.5px] leading-[1.6] text-foreground/75 sm:pl-8 [&_b]:font-medium [&_b]:text-foreground [&>*:not([data-code-panel])]:max-w-[588px]"
                onBlur={(e) => {
                  if (
                    e.target instanceof HTMLInputElement &&
                    !e.currentTarget.contains(e.relatedTarget as Node | null)
                  )
                    onSettle(i);
                }}
              >
                <CopiedContext.Provider value={() => onSettle(i)}>
                  {part.body}
                </CopiedContext.Provider>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
