"use client";

import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { config } from "@/lib/config";
import { formatMoney } from "@/components/settings/PlanSummary";
import {
  FLAT_PLANS,
  type BillingInterval,
  type PlanChoice,
  type PlanKey,
} from "@/types/payment";
import { OutlineButton, RadioDot } from "../../primitives";

const PLAN_LINES: Record<PlanKey, string> = {
  growth_250k: "Up to 250,000 monthly active users",
  growth_500k: "Up to 500,000 monthly active users",
  scale_1m: "Up to 1M users · uptime SLA and priority support",
};

export const planLabel = (choice: PlanChoice) => {
  const plan = FLAT_PLANS.find((p) => p.key === choice.plan)!;
  const yearly = choice.interval === "yearly";
  return `${plan.name} ${plan.cap} · ${formatMoney(yearly ? plan.yearly : plan.monthly)} / ${yearly ? "year" : "month"}`;
};

const INTERVALS: { value: BillingInterval; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

/** The upgrade dialog's plans, inline under "Your own domain". */
export const PlanList = ({
  value,
  onChange,
}: {
  value: PlanChoice;
  onChange: (choice: PlanChoice) => void;
}) => {
  const yearly = value.interval === "yearly";
  return (
    <div>
      <div className="mt-[18px] mb-2 flex items-center justify-between">
        <span className="text-[13px] font-medium">Plan</span>
        <div
          role="group"
          aria-label="Billing interval"
          className="inline-flex rounded-lg border border-foreground/[0.13] p-0.5 text-[12.5px]"
        >
          {INTERVALS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={value.interval === option.value}
              onClick={() => onChange({ ...value, interval: option.value })}
              className={cn(
                "rounded-md px-2.5 py-1 text-muted-foreground",
                value.interval === option.value &&
                  "bg-foreground text-background"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div
        role="radiogroup"
        aria-label="Plan"
        className="overflow-hidden rounded-[9px] border border-foreground/[0.11] bg-background"
      >
        {FLAT_PLANS.map((plan) => {
          const on = plan.key === value.plan;
          return (
            <button
              key={plan.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange({ ...value, plan: plan.key })}
              className="grid w-full grid-cols-[16px_1fr_auto] items-center gap-[11px] border-t border-border px-[13px] py-[11px] text-left text-[13.5px] first:border-t-0"
            >
              <RadioDot on={on} />
              <span className="min-w-0">
                <span className="block font-medium">
                  {plan.name} {plan.cap}
                </span>
                <span className="block text-[12.5px] text-muted-foreground">
                  {PLAN_LINES[plan.key]}
                </span>
              </span>
              <span className="text-right whitespace-nowrap tabular-nums">
                {yearly && (
                  <s className="mr-1.5 text-xs text-muted-foreground/70">
                    {formatMoney(plan.monthly * 12)}
                  </s>
                )}
                {formatMoney(yearly ? plan.yearly : plan.monthly)}
                <small className="block text-[11.5px] text-muted-foreground">
                  per {yearly ? "year" : "month"}
                </small>
              </span>
            </button>
          );
        })}
        <div className="grid grid-cols-[16px_1fr_auto] items-center gap-[11px] border-t border-border bg-muted/70 px-[13px] py-[11px] text-[13.5px] dark:bg-white/[0.02]">
          <Mail className="size-3.5 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block font-medium">Enterprise</span>
            <span className="block text-[12.5px] text-muted-foreground">
              Over 1M users, self-hosting, SSO and custom terms
            </span>
          </span>
          <OutlineButton asChild className="h-7 text-[12.5px]">
            <a href={config.salesUrl} target="_blank" rel="noreferrer">
              Talk to sales
            </a>
          </OutlineButton>
        </div>
      </div>
    </div>
  );
};
