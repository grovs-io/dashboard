import { Check, X } from "lucide-react";
import { Button } from "../../ui/button";
import { Skeleton } from "../../ui/skeleton";
import { cn } from "@/lib/utils";
import { FREE_MAU_LABEL, type BillingInterval } from "@/types/payment";
import { formatMoneyExact, type FlatPlan } from "../PlanSummary";
import StepHeader from "./StepHeader";

type Status = "done" | "working" | "pending" | "error";

const TimelineItem = ({
  status,
  title,
  detail,
  meta,
}: {
  status: Status;
  title: string;
  detail: string;
  meta?: string;
}) => (
  <li className="relative grid grid-cols-[22px_1fr_auto] items-start gap-3 py-2.5 [&:not(:last-child)]:after:absolute [&:not(:last-child)]:after:top-[34px] [&:not(:last-child)]:after:-bottom-0.5 [&:not(:last-child)]:after:left-[10.5px] [&:not(:last-child)]:after:w-px [&:not(:last-child)]:after:bg-border">
    <span
      className={cn(
        "grid size-[22px] place-items-center rounded-full",
        status === "done" && "bg-valid-green text-white",
        status === "error" && "bg-destructive text-white",
        status === "working" &&
          "animate-spin border-2 border-chart-users/20 border-t-chart-users",
        status === "pending" && "border border-border bg-background"
      )}
    >
      {status === "done" && <Check className="size-3 stroke-[3]" />}
      {status === "error" && <X className="size-3 stroke-[3]" />}
    </span>
    <div>
      <span
        className={cn(
          "block text-[13.5px] font-medium",
          status === "pending" && "text-muted-foreground"
        )}
      >
        {title}
      </span>
      <span className="text-[12.5px] text-muted-foreground">{detail}</span>
    </div>
    {meta && <span className="text-xs text-muted-foreground/70">{meta}</span>}
  </li>
);

const ActivatingStep = ({
  plan,
  interval,
  status,
  onClose,
}: {
  plan: FlatPlan;
  interval: BillingInterval;
  status: "working" | "payment_issue" | "timed_out";
  onClose: () => void;
}) => {
  const charged = interval === "yearly" ? plan.yearly : plan.monthly;
  const unlocks =
    plan.inherits === "Growth"
      ? "Uptime SLA, priority support, onboarding"
      : "Custom link domain, event stream, retention controls";
  const failed = status === "payment_issue";
  const working = status === "working";

  return (
    <>
      <StepHeader current={3} />
      <div className="grid grid-cols-1 md:min-h-[560px] md:grid-cols-[1fr_340px]">
        <div className="px-6 py-8 md:px-10 md:py-9">
          <h3 className="text-2xl leading-tight font-semibold tracking-[-0.025em]">
            {failed
              ? "Payment needs attention"
              : working
                ? "Payment received"
                : "Still activating"}
          </h3>
          <p
            role={failed ? "alert" : undefined}
            className="mt-2 max-w-[480px] text-sm leading-[1.55] text-muted-foreground"
          >
            {failed
              ? "Your payment didn't go through. Open Manage billing to update your card, then try again."
              : working
                ? `We're switching this project to ${plan.name}. It takes a few seconds, and you can close this window if you like.`
                : "Your payment is safe. If your plan isn't active in a few minutes, contact support."}
          </p>
          <ol className="mt-7 flex flex-col">
            {failed ? (
              <TimelineItem
                status="error"
                title="Payment didn't go through"
                detail="Your plan hasn't changed"
              />
            ) : (
              <TimelineItem
                status="done"
                title="Payment confirmed by Stripe"
                detail={`${formatMoneyExact(charged)} charged`}
                meta="just now"
              />
            )}
            <TimelineItem
              status={working ? "working" : "pending"}
              title={`Switching the project to ${plan.name}`}
              detail={`Monthly active user limit goes from ${FREE_MAU_LABEL} to ${plan.cap}`}
            />
            <TimelineItem
              status="pending"
              title={`Unlocking ${plan.name} features`}
              detail={unlocks}
            />
          </ol>
          {!working && (
            <Button
              variant="outline"
              size="sm"
              className="mt-6"
              onClick={onClose}
            >
              Close
            </Button>
          )}
        </div>
        <div className="flex flex-col border-t border-border bg-muted/50 p-6 md:border-t-0 md:border-l">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Receipt</span>
            <span className="text-xs text-muted-foreground">Preparing…</span>
          </div>
          <Skeleton className="mt-4 h-[26px] w-3/5" />
          <Skeleton className="mt-2 h-2.5 w-2/5" />
          <div className="mt-[18px] mb-3.5 h-px bg-border" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="mt-2 h-2.5 w-4/5" />
          <Skeleton className="mt-2 h-2.5 w-[70%]" />
        </div>
      </div>
    </>
  );
};

export default ActivatingStep;
