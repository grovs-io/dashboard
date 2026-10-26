"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Cloud, Server, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent } from "../ui/dialog";
import { Button } from "../ui/button";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Skeleton } from "../ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { config } from "@/lib/config";
import { getApiErrorInfo } from "@/lib/ApiError";
import { queryKeys } from "@/lib/queryKeys";
import { showErrorNotification } from "@/lib/Notifications";
import { hasStripeKey } from "@/lib/stripe";
import { isStripeOverlay } from "@/lib/stripeOverlay";
import { trackEvent, EVENTS } from "@/analytics";
import { useProjectSelection } from "@/context/useProjectSelection";
import { useCreateSubscriptionMutation } from "@/hooks/mutations/usePaymentsMutations";
import {
  useSubscriptionQuery,
  type SubscriptionResult,
} from "@/hooks/queries/usePaymentsQueries";
import type { Subscription } from "@/types";
import {
  FLAT_PLANS,
  type BillingInterval,
  type PlanChoice,
  type PlanKey,
} from "@/types/payment";
import PlanSummary, { formatMoney, type FlatPlan } from "./PlanSummary";
import PaymentStep from "./upgrade/PaymentStep";
import ActivatingStep from "./upgrade/ActivatingStep";
import DoneStep from "./upgrade/DoneStep";
import StepHeader from "./upgrade/StepHeader";

const INTERVALS: { value: BillingInterval; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const ALTERNATIVES: { icon: LucideIcon; title: string; description: string }[] =
  [
    {
      icon: Cloud,
      title: "More than 1M MAU",
      description: "Enterprise in our cloud, one flat licence, custom terms",
    },
    {
      icon: Server,
      title: "Self-hosted",
      description:
        "Run grovs on your own infrastructure, with SSO and audit log",
    },
  ];

const PlanRow = ({
  plan,
  interval,
  selected,
}: {
  plan: FlatPlan;
  interval: BillingInterval;
  selected: boolean;
}) => {
  const id = useId();
  const yearly = interval === "yearly";
  return (
    <label
      htmlFor={id}
      className={cn(
        "grid cursor-pointer grid-cols-[16px_1fr_auto] items-center gap-3.5 rounded-[10px] border border-border bg-background px-4 py-3.5 transition-colors",
        selected ? "border-chart-users bg-chart-users/5" : "hover:bg-muted/50"
      )}
    >
      <RadioGroupItem
        id={id}
        value={plan.key}
        className="data-[state=checked]:border-chart-users"
      />
      <div className="min-w-0">
        <div className="text-sm font-semibold">
          {plan.name}
          <span className="ml-1.5 font-normal text-muted-foreground">
            {plan.band}
          </span>
        </div>
        <div className="mt-[3px] text-[12.5px] text-muted-foreground">
          {plan.description}
        </div>
      </div>
      <div className="text-right whitespace-nowrap tabular-nums">
        <div className="flex items-baseline justify-end gap-2">
          {yearly && (
            <s className="text-[13px] text-muted-foreground/70">
              {formatMoney(plan.monthly * 12)}
            </s>
          )}
          <span className="text-[15.5px] font-semibold">
            {formatMoney(yearly ? plan.yearly : plan.monthly)}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          per {yearly ? "year" : "month"}
        </div>
      </div>
    </label>
  );
};

const PlanPicker = ({
  initial,
  onContinue,
  isPending,
}: {
  initial: PlanChoice;
  onContinue: (choice: PlanChoice) => void;
  isPending?: boolean;
}) => {
  const [interval, setBillingInterval] = useState<BillingInterval>(
    initial.interval
  );
  const [planKey, setPlanKey] = useState<PlanKey>(initial.plan);
  const plan = FLAT_PLANS.find((p) => p.key === planKey)!;

  return (
    <>
      <StepHeader
        current={1}
        description="Flat price per band. Every feature included, no per-MAU bills."
      />
      <div className="grid grid-cols-1 md:grid-cols-[1fr_330px]">
        <div className="px-6 pt-5 pb-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Choose a plan
            </span>
            <div
              role="group"
              aria-label="Billing interval"
              className="inline-flex rounded-lg border border-border bg-background p-0.5"
            >
              {INTERVALS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={interval === value}
                  onClick={() => setBillingInterval(value)}
                  className={cn(
                    "rounded-md px-3.5 py-[5px] text-[12.5px] font-medium transition-colors",
                    interval === value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <RadioGroup
            aria-label="Plan"
            value={planKey}
            onValueChange={(value) => setPlanKey(value as PlanKey)}
            className="gap-2"
          >
            {FLAT_PLANS.map((p) => (
              <PlanRow
                key={p.key}
                plan={p}
                interval={interval}
                selected={p.key === planKey}
              />
            ))}
          </RadioGroup>

          <div className="mt-5">
            <span className="mb-2 block text-xs font-medium text-muted-foreground">
              Need something else
            </span>
            <div className="divide-y divide-border overflow-hidden rounded-[10px] border border-border">
              {ALTERNATIVES.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="grid grid-cols-[28px_1fr_auto] items-center gap-3 px-4 py-3"
                >
                  <div className="grid size-7 place-items-center rounded-[7px] border border-border bg-background text-foreground/80">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold">{title}</div>
                    <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                      {description}
                    </div>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-[30px] text-[12.5px]"
                  >
                    <a
                      href={config.salesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Contact sales
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <PlanSummary
          plan={plan}
          interval={interval}
          isPending={isPending}
          onContinue={() => onContinue({ plan: plan.key, interval })}
        />
      </div>
    </>
  );
};

const DEFAULT_CHOICE: PlanChoice = { plan: "growth_250k", interval: "yearly" };

type Step = "plan" | "payment" | "activating" | "done";

const ACTIVATION_TIMEOUT_MS = 180_000;
const RECEIPT_WAIT_MS = 30_000;
const WATCH_INTERVAL_MS = 3000;
const WATCH_TIMEOUT_MS = 120_000;

// Defensive: never treat a still-"pending" subscription as a payment issue.
const hasPaymentIssue = (sub: Subscription | null | undefined) =>
  !!sub?.payment_issue && sub.status !== "pending";

const settled = (sub: Subscription | null | undefined) =>
  hasPaymentIssue(sub) || (!!sub?.plan && !!sub.details?.active);

const UpgradeFlow = ({
  onClose,
  submitting,
  onSubmittingChange,
  onStepChange,
  initialChoice,
}: {
  onClose: () => void;
  submitting: boolean;
  onSubmittingChange: (submitting: boolean) => void;
  onStepChange: (step: Step) => void;
  initialChoice?: PlanChoice;
}) => {
  const { selectedInstance } = useProjectSelection();
  const instanceId = selectedInstance?.id;
  const createSubscription = useCreateSubscriptionMutation(instanceId);
  const [step, setStep] = useState<Step>("plan");
  const [choice, setChoice] = useState<PlanChoice>(
    initialChoice ?? DEFAULT_CHOICE
  );
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [receiptWaitOver, setReceiptWaitOver] = useState(false);
  const [activationTimedOut, setActivationTimedOut] = useState(false);

  const subscriptionQuery = useSubscriptionQuery(instanceId, {
    refetchInterval: (query) => {
      const sub = query.state.data?.subscription;
      if (step === "activating")
        return hasPaymentIssue(sub) || activationTimedOut ? false : 1500;
      if (step === "done")
        return sub?.latest_invoice?.status === "paid" || receiptWaitOver
          ? false
          : 4000;
      return false;
    },
  });
  const subscription = subscriptionQuery.data?.subscription ?? null;
  const active = !!subscription?.plan && !!subscription.details?.active;
  const plan = FLAT_PLANS.find((p) => p.key === choice.plan)!;

  if (step === "activating" && active) setStep("done");

  useEffect(() => onStepChange(step), [step, onStepChange]);

  useEffect(() => {
    if (step !== "done") return;
    const timer = setTimeout(() => setReceiptWaitOver(true), RECEIPT_WAIT_MS);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (step !== "activating") return;
    const timer = setTimeout(
      () => setActivationTimedOut(true),
      ACTIVATION_TIMEOUT_MS
    );
    return () => clearTimeout(timer);
  }, [step]);

  const handleComplete = useCallback(() => {
    trackEvent(EVENTS.PURCHASE, {
      instanceId,
      plan: choice.plan,
      interval: choice.interval,
    });
    setStep("activating");
  }, [instanceId, choice]);

  const startCheckout = async (next: PlanChoice) => {
    setChoice(next);
    if (!hasStripeKey) {
      setClientSecret(null);
      setStep("payment");
      return true;
    }
    try {
      const response = await createSubscription.mutateAsync(next);
      setClientSecret(response.data.client_secret);
      setStep("payment");
      return true;
    } catch (error) {
      showErrorNotification(getApiErrorInfo(error).message);
      return false;
    }
  };

  // A plan picked elsewhere (the guided setup) goes straight to payment.
  const [showPicker, setShowPicker] = useState(!initialChoice);
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!initialChoice || autoStarted.current) return;
    autoStarted.current = true;
    void startCheckout(initialChoice).then((ok) => {
      if (!ok) setShowPicker(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);

  const backToPlan = () => {
    setShowPicker(true);
    setClientSecret(null);
    setStep("plan");
  };

  if (step === "payment") {
    return (
      <PaymentStep
        plan={plan}
        interval={choice.interval}
        clientSecret={clientSecret}
        onBack={backToPlan}
        onComplete={handleComplete}
        submitting={submitting}
        onSubmittingChange={onSubmittingChange}
      />
    );
  }
  if (step === "done") {
    return (
      <DoneStep
        plan={plan}
        interval={choice.interval}
        subscription={subscription}
        onDone={onClose}
      />
    );
  }
  if (step === "activating") {
    return (
      <ActivatingStep
        plan={plan}
        interval={choice.interval}
        status={
          hasPaymentIssue(subscription)
            ? "payment_issue"
            : activationTimedOut
              ? "timed_out"
              : "working"
        }
        onClose={onClose}
      />
    );
  }
  if (!showPicker) {
    return (
      <>
        <StepHeader current={2} />
        <div
          aria-label="Loading payment form"
          className="grid gap-4 p-6 md:grid-cols-[340px_1fr]"
        >
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }
  return (
    <PlanPicker
      initial={choice}
      onContinue={startCheckout}
      isPending={createSubscription.isPending}
    />
  );
};

const ScaleUpDialog = ({
  open,
  onOpenChange,
  initialChoice,
  onPurchased,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Skips the plan step and opens payment for this plan. */
  initialChoice?: PlanChoice;
  /** Called when the dialog closes after a successful purchase. */
  onPurchased?: () => void;
}) => {
  const { selectedInstance } = useProjectSelection();
  const instanceId = selectedInstance?.id;
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const stepRef = useRef<Step>("plan");
  const onStepChange = useCallback((step: Step) => {
    stepRef.current = step;
  }, []);
  // Closed mid-activation: keep the shared subscription query fresh so the plan card catches up.
  const [watching, setWatching] = useState<string | null>(null);

  useEffect(() => {
    if (!watching || open) return;
    const queryKey = queryKeys.payments.subscription(watching);
    const poll = setInterval(async () => {
      // Don't let a tick cancel a slow in-flight request.
      await queryClient.refetchQueries({ queryKey }, { cancelRefetch: false });
      const data = queryClient.getQueryData<SubscriptionResult>(queryKey);
      if (settled(data?.subscription)) setWatching(null);
    }, WATCH_INTERVAL_MS);
    const giveUp = setTimeout(() => setWatching(null), WATCH_TIMEOUT_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(giveUp);
    };
  }, [watching, open, queryClient]);

  const handleOpenChange = (next: boolean) => {
    if (!next && submitting) return;
    if (!next && instanceId) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.payments.subscription(instanceId),
      });
      setWatching(stepRef.current === "activating" ? instanceId : null);
    }
    if (!next && stepRef.current === "done") onPurchased?.();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="block max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-xl p-0 sm:max-w-[980px]"
        onEscapeKeyDown={(event) => submitting && event.preventDefault()}
        onInteractOutside={(event) => {
          if (submitting || isStripeOverlay(event.target))
            event.preventDefault();
        }}
      >
        <UpgradeFlow
          onClose={() => handleOpenChange(false)}
          submitting={submitting}
          onSubmittingChange={setSubmitting}
          onStepChange={onStepChange}
          initialChoice={initialChoice}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ScaleUpDialog;
