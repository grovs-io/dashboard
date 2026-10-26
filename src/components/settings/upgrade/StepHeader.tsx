import { Fragment } from "react";
import { Check, ChevronLeft, X } from "lucide-react";
import { DialogClose, DialogDescription, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { cn } from "@/lib/utils";

const STEPS = ["Plan", "Payment", "Done"];

const StepTracker = ({ current }: { current: number }) => (
  <ol aria-label="Progress" className="flex items-center gap-2">
    {STEPS.map((label, index) => {
      const step = index + 1;
      const done = step < current;
      const active = step === current;
      return (
        <Fragment key={label}>
          {index > 0 && <span aria-hidden className="h-px w-6 bg-border" />}
          <li
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex items-center gap-[7px] text-[12.5px] text-muted-foreground",
              active && "font-medium text-foreground"
            )}
          >
            <span
              className={cn(
                "grid size-[18px] place-items-center rounded-full border border-border text-[10.5px] font-semibold",
                done && "border-foreground bg-foreground text-background",
                active &&
                  "border-chart-users text-chart-users ring-3 ring-chart-users/15"
              )}
            >
              {done ? <Check className="size-2.5 stroke-[3]" /> : step}
            </span>
            {label}
          </li>
        </Fragment>
      );
    })}
  </ol>
);

const StepHeader = ({
  current,
  onBack,
  description,
  locked,
}: {
  current?: number;
  onBack?: () => void;
  description?: string;
  locked?: boolean;
}) => (
  <div className="flex items-center gap-4 border-b border-border py-3.5 pr-[18px] pl-5">
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      {onBack && (
        <Button
          variant="outline"
          size="icon"
          className="size-[30px] shrink-0"
          onClick={onBack}
          disabled={locked}
        >
          <ChevronLeft className="size-3.5" />
          <span className="sr-only">Back</span>
        </Button>
      )}
      <div className="min-w-0">
        <DialogTitle className="text-[15px] leading-normal tracking-[-0.01em]">
          Upgrade project
        </DialogTitle>
        <DialogDescription
          className={description ? "mt-0.5 text-[13px]" : "sr-only"}
        >
          {description ?? "Pay for the plan and activate it on this project."}
        </DialogDescription>
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-4">
      {current && (
        <div className="hidden sm:block">
          <StepTracker current={current} />
        </div>
      )}
      <DialogClose asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-[30px] shrink-0 text-muted-foreground"
          disabled={locked}
        >
          <X className="size-3.5" />
          <span className="sr-only">Close</span>
        </Button>
      </DialogClose>
    </div>
  </div>
);

export default StepHeader;
