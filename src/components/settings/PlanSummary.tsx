import type { ReactNode } from "react";
import { Check, Lock } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { FLAT_PLANS, type BillingInterval } from "@/types/payment";

export type FlatPlan = (typeof FLAT_PLANS)[number];

export const formatMoney = (amount: number) =>
  `$${amount.toLocaleString("en-US")}`;

export const formatMoneyExact = (amount: number) =>
  `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const formatDate = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const renewalDate = (interval: BillingInterval) => {
  const date = new Date();
  if (interval === "yearly") date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1);
  return formatDate(date);
};

const Line = ({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex justify-between gap-3 py-[3px] text-[13px] tabular-nums",
      className
    )}
  >
    <span>{label}</span>
    {value}
  </div>
);

const PlanSummary = ({
  plan,
  interval,
  isPending,
  onContinue,
  onChange,
  changeDisabled,
  layout = "plan",
}: {
  plan: FlatPlan;
  interval: BillingInterval;
  isPending?: boolean;
  onContinue?: () => void;
  onChange?: () => void;
  changeDisabled?: boolean;
  /** "checkout" is the compact summary that sits left of the payment form. */
  layout?: "plan" | "checkout";
}) => {
  const yearly = interval === "yearly";
  const twelveMonths = plan.monthly * 12;
  const savings = twelveMonths - plan.yearly;
  const due = yearly ? plan.yearly : plan.monthly;

  if (layout === "checkout") {
    return (
      <div className="flex flex-col border-t border-border bg-muted/50 p-6 md:border-t-0 md:border-r">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] font-medium text-muted-foreground">
            {plan.name} {plan.cap} · billed {interval}
          </p>
          {onChange && (
            <button
              type="button"
              onClick={onChange}
              disabled={changeDisabled}
              className="text-[12.5px] font-medium disabled:pointer-events-none disabled:opacity-50 text-[var(--chart-users)] hover:text-[var(--chart-users-hover)]"
            >
              Change
            </button>
          )}
        </div>
        <div className="mt-1.5 text-[30px] leading-tight font-bold tracking-[-0.02em] tabular-nums">
          {formatMoney(due)}
          <span className="ml-1 text-[13px] font-normal tracking-normal text-muted-foreground">
            / {yearly ? "year" : "month"}
          </span>
        </div>
        {yearly && savings > 0 && (
          <p className="mt-0.5 text-[12.5px] text-valid-green">
            You save {formatMoney(savings)} vs monthly
          </p>
        )}
        <ul className="my-[18px] flex flex-col gap-1.5">
          {plan.features.map((feature) => (
            <li
              key={feature}
              className="flex gap-2 text-[13px] leading-[1.5] text-foreground/80"
            >
              <Check className="mt-[3px] size-3.5 shrink-0 text-valid-green" />
              {feature}
            </li>
          ))}
        </ul>
        <Line
          label="Due today"
          value={<span>{formatMoneyExact(due)}</span>}
          className="border-t border-border pt-3 text-sm font-semibold"
        />
        <p className="mt-1.5 text-[12.5px] text-muted-foreground">
          Renews {renewalDate(interval)}. Cancel any time.
        </p>
        <p className="mt-auto pt-5 text-[11.5px] leading-[1.5] text-muted-foreground">
          <Lock className="mr-1 inline size-3 align-[-2px]" />
          Card details go straight to Stripe; grovs never sees them. Your
          company name, tax ID and address appear on every invoice.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col border-t border-border bg-muted/50 p-[22px] md:border-t-0 md:border-l">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            {plan.name}, {plan.band}
          </h3>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Billed {interval}
          </p>
        </div>
        {onChange && (
          <button
            type="button"
            onClick={onChange}
            disabled={changeDisabled}
            className="text-[12.5px] font-medium disabled:pointer-events-none disabled:opacity-50 text-[var(--chart-users)] hover:text-[var(--chart-users-hover)]"
          >
            Change
          </button>
        )}
      </div>
      <div className="mt-4 text-[32px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
        {formatMoney(due)}
        <span className="ml-1 text-[13px] font-normal tracking-normal text-muted-foreground">
          / {yearly ? "year" : "month"}
        </span>
      </div>

      <div className="mt-[18px] mb-3.5 h-px bg-border" />
      <p className="mb-2.5 text-xs font-medium text-muted-foreground">
        Everything in {plan.inherits}, plus
      </p>
      <ul className="flex flex-col gap-2">
        {plan.features.map((feature) => (
          <li
            key={feature}
            className="flex gap-[9px] text-[13px] leading-[1.4] text-foreground/80"
          >
            <Check className="mt-0.5 size-3.5 shrink-0 text-chart-users" />
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-[18px] mb-3.5 h-px bg-border" />
      <div className="text-foreground/80">
        {yearly ? (
          <>
            <Line
              label={`12 × ${formatMoney(plan.monthly)} monthly`}
              value={
                <s className="text-muted-foreground/70">
                  {formatMoneyExact(twelveMonths)}
                </s>
              }
            />
            <Line
              label="Yearly price"
              value={<span>{formatMoneyExact(plan.yearly)}</span>}
            />
            <Line
              label="You save"
              value={
                <span className="font-medium text-valid-green">
                  {formatMoneyExact(savings)}
                </span>
              }
            />
          </>
        ) : (
          <>
            <Line
              label="Monthly price"
              value={<span>{formatMoneyExact(plan.monthly)}</span>}
            />
            <Line
              label="Pay yearly instead"
              value={
                <span className="text-right">
                  {formatMoney(plan.yearly)} / year, save {formatMoney(savings)}
                </span>
              }
            />
          </>
        )}
        <Line
          label="Due today"
          value={<span>{formatMoneyExact(due)}</span>}
          className="mt-2 border-t border-border pt-2.5 font-semibold text-foreground"
        />
      </div>

      {onContinue ? (
        <div className="mt-auto pt-[18px]">
          <Button
            className="h-[38px] w-full"
            disabled={isPending}
            onClick={onContinue}
          >
            Continue to payment
          </Button>
          <p className="mt-2 text-center text-[11.5px] leading-[1.45] text-muted-foreground">
            Renews on {renewalDate(interval)}. Payment is handled by Stripe.
            Cancel any time and keep access until the end of the paid period.
          </p>
        </div>
      ) : (
        <p className="mt-5 text-[11.5px] leading-[1.5] text-muted-foreground">
          <Lock className="mr-1 inline size-3 align-[-2px]" />
          Card details go straight to Stripe; grovs never sees them. Your
          company name, tax ID and address appear on every invoice. Renews{" "}
          {renewalDate(interval)}. Cancel any time and keep access until the end
          of the paid period.
        </p>
      )}
    </div>
  );
};

export default PlanSummary;
