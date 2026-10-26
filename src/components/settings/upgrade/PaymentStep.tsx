import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  BillingAddressElement,
  CheckoutElementsProvider,
  PaymentElement,
  TaxIdElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import type { Appearance } from "@stripe/stripe-js";
import { useTheme } from "next-themes";
import { AlertCircle, Loader2, Lock } from "lucide-react";
import { getStripe, hasStripeKey } from "@/lib/stripe";
import {
  removeStripeTestHelper,
  shieldStripeOverlayFocus,
} from "@/lib/stripeOverlay";
import type { BillingInterval } from "@/types/payment";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Skeleton } from "../../ui/skeleton";
import PlanSummary, { formatMoney, type FlatPlan } from "../PlanSummary";
import StepHeader from "./StepHeader";

const InlineError = ({ children }: { children: ReactNode }) => (
  <div
    role="alert"
    className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive"
  >
    <AlertCircle className="size-4 shrink-0" />
    {children}
  </div>
);

const GENERIC_ERROR = "Something went wrong. Please try again.";
const INCOMPLETE_ERROR = "Fill in the highlighted fields to continue.";

// confirm() resolves {type:"error", error} but can also throw (IntegrationError) or return a bare {error}.
const stripeMessage = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null;
  const { message, error } = value as { message?: unknown; error?: unknown };
  if (typeof message === "string" && message) return message;
  return stripeMessage(error);
};

const logInDev = (value: unknown) => {
  if (process.env.NODE_ENV !== "production") {
    console.error("Stripe confirm failed", value);
  }
};

const FONTS = [
  { cssSrc: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600" },
];

const appearance = (dark: boolean): Appearance => ({
  theme: dark ? "night" : "stripe",
  variables: {
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif",
    fontSizeBase: "14px",
    borderRadius: "8px",
    colorPrimary: dark ? "#50A0FF" : "#2A86FF",
    colorBackground: dark ? "#0A0A0A" : "#FFFFFF",
    colorText: dark ? "#FAFAFA" : "#020617",
    colorTextSecondary: dark ? "#A1A1A1" : "#64748B",
    colorDanger: dark ? "#FF6467" : "#E7000B",
  },
  rules: {
    ".Input": {
      border: `1px solid ${dark ? "rgba(255,255,255,0.15)" : "#E5E5E5"}`,
      boxShadow: "none",
    },
    ".Input:focus": {
      borderColor: dark ? "#50A0FF" : "#2A86FF",
      boxShadow: "0 0 0 3px rgba(42,134,255,0.15)",
    },
    ".Label": { fontWeight: "500", fontSize: "13px" },
    ".Tab": {
      border: `1px solid ${dark ? "rgba(255,255,255,0.15)" : "#E5E5E5"}`,
      boxShadow: "none",
    },
  },
});

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <div className="mb-1.5 text-[13px] font-medium">{label}</div>
    {children}
  </div>
);

type SubmitProps = {
  submitting: boolean;
  onSubmittingChange: (submitting: boolean) => void;
};

const CheckoutForm = ({
  price,
  per,
  onComplete,
  submitting,
  onSubmittingChange,
}: {
  price: string;
  per: "year" | "month";
  onComplete: () => void;
} & SubmitProps) => {
  const state = useCheckoutElements();
  const businessId = useId();
  const [business, setBusiness] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completed = useRef(false);

  if (state.type === "loading") {
    return (
      <div className="space-y-4" aria-label="Loading payment form">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (state.type === "error")
    return <InlineError>{state.error.message}</InlineError>;

  const { checkout } = state;

  const clearError = () => setError(null);

  const toggleBusiness = (next: boolean) => {
    clearError();
    setBusiness(next);
    if (!next && checkout.taxIdInfo) void checkout.updateTaxIdInfo(null);
  };

  const complete = () => {
    if (completed.current) return;
    completed.current = true;
    onComplete();
  };

  const subscribe = async () => {
    setError(null);
    if (!checkout.canConfirm) {
      // validateElements makes each Stripe element highlight its own missing fields.
      void Promise.resolve(checkout.validateElements?.()).catch(() => {});
      setError(INCOMPLETE_ERROR);
      return;
    }
    onSubmittingChange(true);
    try {
      // returnUrl is required by Stripe.js even with redirect "if_required"; no redirect methods are enabled.
      const result = await checkout.confirm({
        redirect: "if_required",
        returnUrl: window.location.href,
      });
      if (result?.type === "success") complete();
      else {
        logInDev(result);
        setError(stripeMessage(result) ?? GENERIC_ERROR);
      }
    } catch (thrown) {
      logInDev(thrown);
      setError(stripeMessage(thrown) ?? GENERIC_ERROR);
    } finally {
      onSubmittingChange(false);
    }
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void subscribe();
      }}
    >
      <Field label="Email">
        <div className="flex h-10 items-center rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground">
          {checkout.email}
        </div>
      </Field>

      <PaymentElement onChange={clearError} />

      <label
        htmlFor={businessId}
        className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium"
      >
        <Checkbox
          id={businessId}
          checked={business}
          onCheckedChange={(value) => toggleBusiness(value === true)}
        />
        I&apos;m purchasing as a business
      </label>
      {business && (
        <TaxIdElement
          onChange={clearError}
          options={{
            visibility: "always",
            fields: { businessName: "always" },
            validation: { businessName: { required: "always" } },
          }}
        />
      )}

      <BillingAddressElement onChange={clearError} />

      {error && <InlineError>{error}</InlineError>}

      <Button
        type="submit"
        disabled={submitting}
        className="h-[42px] w-full rounded-[9px] bg-foreground text-[14px] font-medium text-background shadow-none hover:bg-foreground/85"
      >
        {submitting ? (
          <Loader2 className="size-4 animate-spin" aria-label="Processing" />
        ) : (
          <Lock className="size-3.5" />
        )}
        Subscribe · {price}
      </Button>
      <p className="-mt-2 text-center text-xs text-muted-foreground">
        By subscribing, you allow grovs to charge you {price} per {per} until
        you cancel.
      </p>
    </form>
  );
};

const Checkout = ({
  clientSecret,
  ...form
}: {
  clientSecret: string;
  price: string;
  per: "year" | "month";
  onComplete: () => void;
} & SubmitProps) => {
  const [stripePromise] = useState(getStripe);
  const [loadFailed, setLoadFailed] = useState(false);
  const dark = useTheme().resolvedTheme === "dark";

  useEffect(shieldStripeOverlayFocus, []);
  useEffect(() => removeStripeTestHelper, []);

  useEffect(() => {
    let live = true;
    stripePromise?.then((stripe) => {
      if (live && !stripe) setLoadFailed(true);
    });
    return () => {
      live = false;
    };
  }, [stripePromise]);

  if (loadFailed) {
    return (
      <InlineError>
        Couldn&apos;t load the payment form. Check your connection or disable
        blockers for this page, then try again.
      </InlineError>
    );
  }
  return (
    <CheckoutElementsProvider
      // The provider applies appearance changes in place, so only a new session remounts.
      key={clientSecret}
      stripe={stripePromise}
      options={{
        clientSecret,
        elementsOptions: { appearance: appearance(dark), fonts: FONTS },
      }}
    >
      <CheckoutForm {...form} />
    </CheckoutElementsProvider>
  );
};

const PaymentStep = ({
  plan,
  interval,
  clientSecret,
  onBack,
  onComplete,
  submitting,
  onSubmittingChange,
}: {
  plan: FlatPlan;
  interval: BillingInterval;
  clientSecret: string | null;
  onBack: () => void;
  onComplete: () => void;
} & SubmitProps) => {
  const yearly = interval === "yearly";
  const price = formatMoney(yearly ? plan.yearly : plan.monthly);
  return (
    <>
      <StepHeader current={2} onBack={onBack} locked={submitting} />
      <div className="grid grid-cols-1 md:min-h-[560px] md:grid-cols-[340px_1fr]">
        <PlanSummary
          plan={plan}
          interval={interval}
          onChange={onBack}
          changeDisabled={submitting}
          layout="checkout"
        />
        <div className="order-first min-w-0 px-6 pt-6 pb-7 md:order-none">
          {hasStripeKey && clientSecret ? (
            <Checkout
              clientSecret={clientSecret}
              price={price}
              per={yearly ? "year" : "month"}
              onComplete={onComplete}
              submitting={submitting}
              onSubmittingChange={onSubmittingChange}
            />
          ) : (
            <InlineError>
              Payments aren&apos;t configured for this environment
            </InlineError>
          )}
        </div>
      </div>
    </>
  );
};

export default PaymentStep;
