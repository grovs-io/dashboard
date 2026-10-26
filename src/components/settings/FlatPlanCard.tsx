import type { ReactNode } from "react";
import { ExternalLink, Loader2, MoreHorizontal } from "lucide-react";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { cn } from "@/lib/utils";
import { config } from "@/lib/config";
import { formatDayMonthYear } from "@/lib/dateUtils";
import { formatCurrencyFromCents } from "@/utils/formatCurrency";
import type { Subscription } from "@/types";

const numberFormatter = new Intl.NumberFormat("en-US");

interface FlatPlanCardProps {
  subscription: Subscription;
  planName: string;
  band: string;
  projectName: string;
  onManageBilling: () => void;
  onCancel: () => void;
  onResume: () => void;
  pending?: "cancel" | "resume" | null;
  listPriceCents?: number;
}

const MenuItemContent = ({
  label,
  hint,
  hintClassName,
}: {
  label: string;
  hint: string;
  hintClassName?: string;
}) => (
  <span className="flex flex-col gap-0.5">
    <span>{label}</span>
    <span className={cn("text-xs text-muted-foreground", hintClassName)}>
      {hint}
    </span>
  </span>
);

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="px-5 py-4 flex flex-col gap-1">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-semibold tabular-nums">{children}</span>
  </div>
);

const FlatPlanCard = ({
  subscription,
  planName,
  band,
  projectName,
  onManageBilling,
  onCancel,
  onResume,
  pending = null,
  listPriceCents,
}: FlatPlanCardProps) => {
  const yearly = subscription.interval === "yearly";
  const renewsOn = formatDayMonthYear(
    subscription.stripe_subscription.current_period_end * 1000
  );
  const endsOn = subscription.cancels_at
    ? formatDayMonthYear(subscription.cancels_at)
    : null;
  const nextInvoiceCents = subscription.amount_cents ?? listPriceCents;
  const maus = subscription.maus;
  const cap = subscription.mau_cap ?? subscription.maus;
  const overLimit = maus > cap;

  const mailSubject = `Change plan for project ${projectName}`;
  const mailBody = `Hi, I'd like to change the plan for project ${projectName}.\n\nCurrent plan: ${planName} · ${band}, billed ${yearly ? "yearly" : "monthly"}.\n\nNew plan / billing period: `;
  const changePlanHref = config.supportEmail
    ? `mailto:${config.supportEmail}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`
    : config.salesUrl;

  const onBlueButton =
    "bg-white hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/15 dark:border-white/20 dark:text-white";
  const itemClass = "rounded-md px-2.5 py-2";

  return (
    <div className="rounded-xl border border-sidebar-border overflow-hidden">
      <div className="grain-light px-5 py-[18px] flex items-center gap-4 border-b border-[rgba(11,42,87,0.12)] [background-image:linear-gradient(160deg,#C7DBFA_0%,#DCE8FB_100%)] dark:border-white/10 dark:[background-image:linear-gradient(160deg,#0F2547_0%,#152F57_100%)]">
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span className="text-base font-semibold tracking-tight text-[#0B2A57] dark:text-white">
            {planName}{" "}
            <span className="font-normal text-[#3B5579] dark:text-white/70">
              · {band}
            </span>
          </span>
          <span className="text-xs text-[#3B5579] dark:text-white/70">
            {`Billed ${yearly ? "yearly" : "monthly"} · ${
              endsOn ? `ends ${endsOn}` : `renews ${renewsOn}`
            }`}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className={onBlueButton}
            onClick={onManageBilling}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Manage billing
          </Button>
          <DropdownMenu modal={false}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className={cn("size-8", onBlueButton)}
                    aria-label="More options"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>More options</TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="end"
              className="w-[260px] flex flex-col gap-0.5"
            >
              <DropdownMenuItem asChild className={itemClass}>
                <a href={changePlanHref}>
                  <MenuItemContent
                    label="Change plan"
                    hint="Move to another band or billing period"
                  />
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem
                className={itemClass}
                onSelect={onManageBilling}
              >
                <MenuItemContent
                  label="Invoices"
                  hint="Download past invoices"
                />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {endsOn ? (
                <DropdownMenuItem
                  className={itemClass}
                  disabled={!!pending}
                  onSelect={onResume}
                >
                  <MenuItemContent
                    label="Resume plan"
                    hint={`Keep ${planName} after ${endsOn}`}
                  />
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  variant="destructive"
                  className={itemClass}
                  disabled={!!pending}
                  onSelect={onCancel}
                >
                  <MenuItemContent
                    label="Cancel plan"
                    hint={`Keeps access until ${renewsOn}`}
                    hintClassName="text-destructive/70"
                  />
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {(endsOn || pending) && (
        <div className="flex items-center gap-4 border-b border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {pending ? (
            <span className="flex flex-1 min-w-0 items-center gap-2 text-xs">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              {pending === "resume"
                ? "Resuming your plan…"
                : `Cancelling… your plan ends on ${renewsOn}`}
            </span>
          ) : (
            <>
              <span className="flex-1 min-w-0 text-xs">
                This plan ends on {endsOn}. After that the project moves to Free
                (up to 10K monthly active users).
              </span>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1.5 h-8 px-3 text-[13px] font-medium rounded-md border border-amber-300 bg-white text-amber-900 shadow-none hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                onClick={onResume}
              >
                Resume plan
              </button>
            </>
          )}
        </div>
      )}

      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground">
            Monthly active users this month
          </span>
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              overLimit ? "text-destructive" : "text-foreground"
            )}
          >
            {numberFormatter.format(maus)}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              / {numberFormatter.format(cap)}
            </span>
          </span>
        </div>
        <Progress
          value={cap > 0 ? Math.min((maus / cap) * 100, 100) : 0}
          className="h-1.5"
          indicatorClassName={
            overLimit ? "bg-destructive" : "bg-[var(--chart-users)]"
          }
        />
        <div className="flex items-center justify-between mt-2">
          {overLimit ? (
            <span className="text-xs text-destructive font-medium">
              Over your band by {numberFormatter.format(maus - cap)} —
              we&apos;ll be in touch to agree the next band.
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {numberFormatter.format(cap - maus)} left this month
            </span>
          )}
          <a
            href={`${process.env.NEXT_PUBLIC_DOCS_URL}/docs/marketing/maus`}
            target="_blank"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            What counts as a MAU
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-sidebar-border border-t border-sidebar-border">
        <Fact label="Next invoice">
          {endsOn ? (
            <>
              None
              <span className="block text-xs font-normal text-muted-foreground">
                Plan ends {endsOn}
              </span>
            </>
          ) : nextInvoiceCents != null ? (
            <>
              {formatCurrencyFromCents(nextInvoiceCents)}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                on {renewsOn}
              </span>
            </>
          ) : (
            "—"
          )}
        </Fact>
        <Fact label="Billing period">{yearly ? "Yearly" : "Monthly"}</Fact>
        <Fact label="Payment">
          Card on file{" "}
          <span className="text-xs font-normal text-muted-foreground">
            · via Stripe
          </span>
        </Fact>
      </div>
    </div>
  );
};

export default FlatPlanCard;
