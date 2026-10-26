import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronRight,
  Download,
  Globe,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../../ui/button";
import { useUserContext } from "@/context/useUserContext";
import {
  FREE_MAU_LABEL,
  type BillingInterval,
  type Subscription,
} from "@/types/payment";
import {
  formatMoneyExact,
  formatDate,
  renewalDate,
  type FlatPlan,
} from "../PlanSummary";
import StepHeader from "./StepHeader";

const NEXT_STEPS: {
  icon: LucideIcon;
  title: string;
  description: string;
  path: string;
}[] = [
  {
    icon: Globe,
    title: "Add your link domain",
    description: "Serve links from links.yourapp.com",
    path: "/dynamic_links/settings/domain",
  },
  {
    icon: Waypoints,
    title: "Stream your events",
    description: "Send every event to a webhook or S3",
    path: "/settings/developers/event_stream",
  },
];

const NewBadge = () => (
  <span className="rounded-full bg-valid-green/10 px-2 py-0.5 text-[11.5px] font-medium text-valid-green">
    New
  </span>
);

const ChangeRow = ({
  label,
  value,
  isNew,
}: {
  label: string;
  value: ReactNode;
  isNew?: boolean;
}) => (
  <div className="grid grid-cols-[minmax(0,180px)_1fr_auto] items-center gap-3 px-4 py-3 text-[13.5px]">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium tabular-nums">{value}</span>
    {isNew ? <NewBadge /> : <span />}
  </div>
);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3 py-[5px] text-[13px] text-foreground/80">
    <span>{label}</span>
    <span className="text-right text-foreground tabular-nums">{value}</span>
  </div>
);

const DoneStep = ({
  plan,
  interval,
  subscription,
  onDone,
}: {
  plan: FlatPlan;
  interval: BillingInterval;
  subscription: Subscription | null;
  onDone: () => void;
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUserContext();

  const invoice =
    subscription?.latest_invoice?.status === "paid"
      ? subscription.latest_invoice
      : null;
  const billedTo = subscription?.billed_to;
  const addressLines = billedTo?.address_lines?.filter(Boolean) ?? [];
  const hasBilledTo = !!(
    billedTo?.name ||
    billedTo?.tax_id ||
    addressLines.length
  );
  const periodEnd = subscription?.stripe_subscription?.current_period_end;

  const goTo = (path: string) => {
    onDone();
    const query = searchParams.toString();
    router.push(`${path}${query ? `?${query}` : ""}`);
  };

  return (
    <>
      <StepHeader />
      <div className="grid grid-cols-1 md:min-h-[560px] md:grid-cols-[1fr_340px]">
        <div className="px-6 py-8 md:px-10 md:py-9">
          <div className="grid size-10 place-items-center rounded-full bg-valid-green/10 text-valid-green">
            <Check className="size-5 stroke-[2]" />
          </div>
          <h3 className="mt-3.5 text-2xl leading-tight font-semibold tracking-[-0.025em]">
            This project is on {plan.name}
          </h3>
          <p className="mt-2 max-w-[480px] text-sm leading-[1.55] text-muted-foreground">
            Your payment went through and the plan is live. A receipt and
            invoice are on their way to {user?.email ?? "your email"}.
          </p>

          <div className="mt-7 divide-y divide-border overflow-hidden rounded-xl border border-border">
            <ChangeRow
              label="Monthly active users"
              value={
                <>
                  <s className="mr-2 font-normal text-muted-foreground/70">
                    {FREE_MAU_LABEL}
                  </s>
                  {plan.cap}
                </>
              }
            />
            <ChangeRow label="Custom link domain" value="Available" isNew />
            <ChangeRow label="Event stream" value="Available" isNew />
            <ChangeRow label="Raw event retention" value="You choose" isNew />
          </div>

          <p className="mt-7 mb-2.5 text-xs font-medium text-muted-foreground">
            Next steps
          </p>
          <div className="flex flex-col gap-2">
            {NEXT_STEPS.map(({ icon: Icon, title, description, path }) => (
              <button
                key={path}
                type="button"
                onClick={() => goTo(path)}
                className="grid grid-cols-[34px_1fr_auto] items-center gap-3 rounded-[10px] border border-border px-3.5 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <span className="grid size-[34px] place-items-center rounded-lg border border-border text-foreground/80">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold">
                    {title}
                  </span>
                  <span className="text-[12.5px] text-muted-foreground">
                    {description}
                  </span>
                </span>
                <span className="flex items-center gap-1 text-[13px] font-medium text-[var(--chart-users)]">
                  Set up
                  <ChevronRight className="size-3" />
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col border-t border-border bg-muted/50 p-6 md:border-t-0 md:border-l">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">Receipt</span>
            {invoice?.number && (
              <span className="text-xs text-muted-foreground">
                Invoice {invoice.number}
              </span>
            )}
          </div>
          {invoice?.amount_paid != null && (
            <div className="mt-3.5 text-[30px] font-semibold tracking-[-0.03em] tabular-nums">
              {formatMoneyExact(invoice.amount_paid / 100)}
            </div>
          )}
          {invoice?.paid_at && (
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Paid {formatDate(new Date(invoice.paid_at * 1000))}
            </p>
          )}

          <div className="mt-[18px] mb-3.5 h-px bg-border" />
          <Row label="Plan" value={`${plan.name}, ${plan.band}`} />
          <Row
            label="Billing"
            value={interval === "yearly" ? "Yearly" : "Monthly"}
          />
          <Row
            label="Next renewal"
            value={
              periodEnd
                ? formatDate(new Date(periodEnd * 1000))
                : renewalDate(interval)
            }
          />

          {hasBilledTo && (
            <>
              <div className="mt-[18px] mb-3.5 h-px bg-border" />
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Billed to
              </p>
              <div className="text-[12.5px] leading-[1.55] text-foreground/80">
                {billedTo?.name && (
                  <div className="font-medium text-foreground">
                    {billedTo.name}
                  </div>
                )}
                {billedTo?.tax_id && <div>{billedTo.tax_id}</div>}
                {addressLines.map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </div>
            </>
          )}

          <div className="mt-auto flex flex-col gap-2 pt-5">
            {invoice?.invoice_pdf && (
              <Button
                asChild
                variant="outline"
                className="h-[38px] bg-background"
              >
                <a
                  href={invoice.invoice_pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="size-[15px]" />
                  Download invoice PDF
                </a>
              </Button>
            )}
            <Button className="h-[38px]" onClick={onDone}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DoneStep;
