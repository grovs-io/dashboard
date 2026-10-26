import { useRef, useState } from "react";
import { Button } from "../ui/button";
import { ExternalLink, Star } from "lucide-react";
import { Progress } from "../ui/progress";
import ScaleUpDialog from "./ScaleUpDialog";
import { useProjectSelection } from "@/context/useProjectSelection";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import { getApiErrorInfo } from "@/lib/ApiError";
import EnterpriseDialog from "./EnterpriseDialog";
import { formatDayMonthYear, formatMediumDate } from "@/lib/dateUtils";
import { Skeleton } from "../ui/skeleton";
import { formatCurrencyFromCents } from "@/utils/formatCurrency";
import { cn } from "@/lib/utils";
import { config } from "@/lib/config";
import { FLAT_PLANS } from "@/types/payment";
import type { Subscription } from "@/types";
import {
  useSubscriptionQuery,
  useMauQuery,
} from "@/hooks/queries/usePaymentsQueries";
import {
  useCancelSubscriptionMutation,
  useResumeSubscriptionMutation,
} from "@/hooks/mutations/usePaymentsMutations";
import { getDashboardUrlAPICall } from "@/api/payments/paymentsService";
import FlatPlanCard from "./FlatPlanCard";
import CancelPlanDialog from "./CancelPlanDialog";

const PlanSection = () => {
  const { selectedInstance } = useProjectSelection();
  const instanceId = selectedInstance?.id;
  const subscriptionQuery = useSubscriptionQuery(instanceId);
  const subscription = subscriptionQuery.data?.subscription ?? null;
  const isPaymentIssue = !!subscription?.payment_issue;
  // Billing/MAU display treats a payment issue like no subscription at all.
  const effectiveSubscription = isPaymentIssue ? null : subscription;
  const isEnterprise = subscriptionQuery.data?.isEnterprise ?? false;
  const planLoaded =
    !subscriptionQuery.isLoading && subscriptionQuery.isFetched;
  const isFlat = !!effectiveSubscription?.plan;
  const flatPlan = FLAT_PLANS.find(
    (p) => p.key === effectiveSubscription?.plan
  );

  const mauQuery = useMauQuery(selectedInstance?.id);
  const mau = mauQuery.data ?? { current_quantity: 0, total_available: 1 };

  const cancelSubscriptionMutation = useCancelSubscriptionMutation(
    selectedInstance?.id
  );
  const resumeSubscriptionMutation = useResumeSubscriptionMutation(
    selectedInstance?.id
  );

  const [scaleUpOpen, setScaleUpOpen] = useState<boolean>(false);
  const [enterpriseOpen, setEnterpriseOpen] = useState<boolean>(false);
  const [cancelOpen, setCancelOpen] = useState<boolean>(false);
  // Sync guard: isPending only flips after a re-render, so a fast double-click would slip through.
  const inFlight = useRef(false);
  const pending = cancelSubscriptionMutation.isPending
    ? "cancel"
    : resumeSubscriptionMutation.isPending
      ? "resume"
      : null;

  const percentage = (current: number, total: number) => {
    return (current / total) * 100;
  };

  const periodEnd = effectiveSubscription?.stripe_subscription
    ? formatDayMonthYear(
        effectiveSubscription.stripe_subscription.current_period_end * 1000
      )
    : "";

  // Joins the refetch the mutation's invalidation already started.
  const refreshedSubscription = async () =>
    (await subscriptionQuery.refetch({ cancelRefetch: false })).data
      ?.subscription ?? effectiveSubscription;

  const periodEndOf = (sub: Subscription | null | undefined) =>
    sub?.stripe_subscription
      ? formatDayMonthYear(sub.stripe_subscription.current_period_end * 1000)
      : periodEnd;

  const refetchSoon = () => {
    setTimeout(() => {
      subscriptionQuery.refetch();
    }, 2500);
  };

  const handleCancelSubscription = async () => {
    if (inFlight.current || !instanceId) return;
    inFlight.current = true;
    try {
      await cancelSubscriptionMutation.mutateAsync();
      if (isFlat) {
        const sub = await refreshedSubscription();
        const endsOn = sub?.cancels_at
          ? formatDayMonthYear(sub.cancels_at)
          : periodEndOf(sub);
        showSuccessNotification(`Your plan ends on ${endsOn}.`);
      } else {
        showSuccessNotification("Your plan has been cancelled.");
        refetchSoon();
      }
    } catch (error) {
      showErrorNotification(getApiErrorInfo(error).message);
    } finally {
      inFlight.current = false;
    }
  };

  const handleResumeSubscription = async () => {
    if (inFlight.current || !instanceId) return;
    inFlight.current = true;
    try {
      await resumeSubscriptionMutation.mutateAsync();
      const sub = await refreshedSubscription();
      showSuccessNotification(`Your plan will renew on ${periodEndOf(sub)}.`);
    } catch (error) {
      showErrorNotification(getApiErrorInfo(error).message);
    } finally {
      inFlight.current = false;
    }
  };

  const handleGoToStripDetails = async () => {
    if (!selectedInstance) return;

    try {
      const response = await getDashboardUrlAPICall(selectedInstance.id);
      const url = response.data.url;

      window.open(url);
    } catch (error) {
      showErrorNotification(getApiErrorInfo(error).message);
    }
  };

  const handleUpgradeEnterprise = () => {
    window.open(config.salesUrl, "_blank");
  };

  const getCurrentMauValue = () => {
    if (effectiveSubscription) {
      if (isEnterprise) {
        return effectiveSubscription.current_maus;
      } else {
        return effectiveSubscription.maus;
      }
    } else {
      return mau.current_quantity;
    }
  };

  const getCurrentTotalMauValue = () => {
    if (effectiveSubscription) {
      if (isEnterprise) {
        return effectiveSubscription.total_maus;
      } else {
        return effectiveSubscription.maus;
      }
    } else {
      return mau.total_available;
    }
  };

  const numberFormatter = new Intl.NumberFormat("en-US");

  const getPlanName = () => {
    if (isPaymentIssue) return "Payment issue";
    if (!effectiveSubscription) return "Free";
    if (isEnterprise) return "Enterprise";
    return "Scale Up";
  };

  const getStartDate = () => {
    if (!effectiveSubscription) return null;
    if (isEnterprise) return formatMediumDate(effectiveSubscription.start_at);
    return formatMediumDate(
      effectiveSubscription.stripe_subscription.current_period_start * 1000
    );
  };

  const getEndDate = () => {
    if (!effectiveSubscription) return null;
    if (isEnterprise) return formatMediumDate(effectiveSubscription.end_at);
    return formatMediumDate(
      effectiveSubscription.stripe_subscription.current_period_end * 1000
    );
  };

  const mauOverLimit = () => {
    if (effectiveSubscription && !isEnterprise) return false;
    return getCurrentTotalMauValue() - getCurrentMauValue() < 0;
  };

  if (!planLoaded) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">Plan & Billing</span>
          <span className="text-xs text-muted-foreground">
            Manage your subscription and monitor usage.
          </span>
        </div>
        <div className="rounded-xl border border-sidebar-border overflow-hidden">
          <div className="px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-3 w-[180px]" />
              </div>
            </div>
          </div>
          <div className="border-t border-sidebar-border px-5 py-4">
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="flex justify-between mt-2">
              <Skeleton className="h-3 w-[120px]" />
              <Skeleton className="h-3 w-[80px]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Section header */}
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">Plan & Billing</span>
        <span className="text-xs text-muted-foreground">
          Manage your subscription and monitor usage.
        </span>
      </div>

      {isFlat && effectiveSubscription ? (
        <FlatPlanCard
          subscription={effectiveSubscription}
          planName={flatPlan?.name ?? "Plan"}
          band={flatPlan?.band ?? ""}
          projectName={selectedInstance?.name ?? ""}
          onManageBilling={handleGoToStripDetails}
          onCancel={() => setCancelOpen(true)}
          onResume={handleResumeSubscription}
          pending={pending}
          listPriceCents={
            flatPlan &&
            (effectiveSubscription.interval === "yearly"
              ? flatPlan.yearly
              : flatPlan.monthly) * 100
          }
        />
      ) : (
        <div
          className={cn(
            "rounded-xl border overflow-hidden",
            !effectiveSubscription
              ? "border-sidebar-border"
              : isEnterprise
                ? "border-chart-2/30"
                : "border-primary/30"
          )}
        >
          {/* Plan tier + actions */}
          <div
            className={cn(
              "px-5 py-5 flex items-center gap-4",
              !effectiveSubscription
                ? "bg-muted/50"
                : isEnterprise
                  ? "bg-gradient-to-r from-chart-2/8 to-chart-2/3"
                  : "bg-gradient-to-r from-primary/8 to-primary/3"
            )}
          >
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="text-lg font-semibold tracking-tight">
                {getPlanName()}
              </span>
              <span className="text-xs text-muted-foreground">
                {isPaymentIssue
                  ? "Update your payment method to restore your plan."
                  : effectiveSubscription
                    ? `${getStartDate()} — ${getEndDate()}`
                    : "Free tier with limited monthly active users."}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isPaymentIssue ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleGoToStripDetails()}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Manage Billing
                </Button>
              ) : !effectiveSubscription ? (
                <>
                  <Button size="sm" onClick={() => setScaleUpOpen(true)}>
                    <Star className="h-3.5 w-3.5" />
                    Upgrade
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEnterpriseOpen(true)}
                  >
                    Enterprise
                  </Button>
                </>
              ) : isEnterprise ? null : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGoToStripDetails()}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Manage Billing
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setCancelOpen(true)}
                  >
                    Cancel Plan
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Usage */}
          <div className="border-t border-sidebar-border px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground">
                Monthly Active Users
              </span>
              <div className="flex items-baseline gap-1">
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    mauOverLimit() ? "text-destructive" : "text-foreground"
                  )}
                >
                  {numberFormatter.format(getCurrentMauValue())}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  / {numberFormatter.format(getCurrentTotalMauValue())}
                </span>
              </div>
            </div>
            <Progress
              value={Math.min(
                percentage(getCurrentMauValue(), getCurrentTotalMauValue()),
                100
              )}
              className="h-1.5"
              indicatorClassName={cn(
                mauOverLimit() ? "bg-destructive" : "bg-valid-green"
              )}
            />
            <div className="flex items-center justify-between mt-2">
              {mauOverLimit() ? (
                <span className="text-xs text-destructive font-medium">
                  Over limit by
                  {numberFormatter.format(
                    Math.abs(getCurrentTotalMauValue() - getCurrentMauValue())
                  )}{" "}
                  — upgrade to continue.
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {numberFormatter.format(
                    getCurrentTotalMauValue() - getCurrentMauValue()
                  )}{" "}
                  remaining this period
                </span>
              )}
              <a
                href={`${process.env.NEXT_PUBLIC_DOCS_URL}/docs/marketing/maus`}
                target="_blank"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Learn more
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Billing breakdown */}
          {effectiveSubscription && !isEnterprise && (
            <div className="border-t border-sidebar-border">
              <div className="grid grid-cols-3 divide-x divide-sidebar-border">
                <div className="px-5 py-4 flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    Total MAUs
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {numberFormatter.format(effectiveSubscription?.maus)}
                  </span>
                </div>
                <div className="px-5 py-4 flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    Billed MAUs
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {numberFormatter.format(
                      effectiveSubscription?.quantity_for_current_billing_cycle
                    )}
                  </span>
                </div>
                <div className="px-5 py-4 flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    Current Period
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrencyFromCents(
                      effectiveSubscription?.amount_cents ?? 0
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <CancelPlanDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        planName={isFlat ? (flatPlan?.name ?? "plan") : "Scale Up"}
        description={
          isFlat
            ? `You keep access until ${periodEnd}. After that the project moves to Free (up to 10K monthly active users) and ${flatPlan?.name ?? "paid"} features turn off. You can resume before then.`
            : "Billing stops now and the project moves to Free (up to 10K monthly active users) straight away."
        }
        onConfirm={handleCancelSubscription}
      />
      <ScaleUpDialog open={scaleUpOpen} onOpenChange={setScaleUpOpen} />
      <EnterpriseDialog
        open={enterpriseOpen}
        onOpenChange={setEnterpriseOpen}
        handleUpgrade={handleUpgradeEnterprise}
      />
    </div>
  );
};

export default PlanSection;
