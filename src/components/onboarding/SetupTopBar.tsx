"use client";

import { Fragment } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectIcon } from "@/components/layout/project-icon";
import { SETUP_STEPS, type SetupStepKey, type SetupView } from "./setupRules";

const StepTracker = ({
  view,
  completed,
  onSelect,
}: {
  view: SetupView;
  completed: Record<SetupStepKey, boolean>;
  onSelect: (step: SetupStepKey) => void;
}) => {
  const currentIndex =
    view === "done"
      ? SETUP_STEPS.length
      : SETUP_STEPS.findIndex((s) => s.key === view);
  return (
    <ol aria-label="Setup progress" className="hidden items-center md:flex">
      {SETUP_STEPS.map((step, i) => {
        const current = i === currentIndex;
        const done = !current && (i < currentIndex || completed[step.key]);
        return (
          <Fragment key={step.key}>
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  "mx-2 h-[1.5px] w-4 rounded-full bg-foreground/15",
                  (done || current) && i <= currentIndex && "bg-valid-green"
                )}
              />
            )}
            <li>
              <button
                type="button"
                onClick={() => onSelect(step.key)}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 text-[12.5px] whitespace-nowrap text-muted-foreground hover:text-foreground",
                  done && "text-foreground/75",
                  current && "font-medium text-foreground"
                )}
              >
                <span
                  className={cn(
                    "grid size-[18px] place-items-center rounded-full border-[1.5px] border-foreground/15 bg-background text-[10px] font-semibold",
                    done && "border-valid-green bg-valid-green text-white",
                    current && "border-chart-users bg-chart-users text-white"
                  )}
                >
                  {done ? <Check className="size-[9px] stroke-[3.5]" /> : i + 1}
                </span>
                {step.label}
              </button>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
};

export const SetupTopBar = ({
  projectName,
  iconUrl,
  view,
  completed,
  onSelect,
  onClose,
}: {
  projectName: string;
  iconUrl?: string | null;
  view: SetupView;
  completed: Record<SetupStepKey, boolean>;
  onSelect: (step: SetupStepKey) => void;
  onClose: () => void;
}) => {
  const index = SETUP_STEPS.findIndex((s) => s.key === view);
  return (
    <header className="flex h-14 shrink-0 items-center gap-5 border-b border-border pr-[18px] pl-4 sm:pl-6">
      <span className="mr-auto flex min-w-0 items-center gap-2.5 text-[13.5px] font-semibold">
        <ProjectIcon
          url={iconUrl}
          name={projectName}
          className="size-6 text-[11px] ring-foreground/15"
        />
        <span className="truncate">Project setup</span>
        {index >= 0 && (
          <span className="shrink-0 text-[12.5px] font-normal text-muted-foreground md:hidden">
            {index + 1} of {SETUP_STEPS.length}
          </span>
        )}
      </span>
      <StepTracker view={view} completed={completed} onSelect={onSelect} />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close setup"
        className="flex h-[22px] items-center border-l border-border pl-4 text-muted-foreground hover:text-foreground"
      >
        <X className="size-[17px]" />
      </button>
    </header>
  );
};
