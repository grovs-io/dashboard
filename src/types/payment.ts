export type PlanKey = "growth_250k" | "growth_500k" | "scale_1m";
export type BillingInterval = "monthly" | "yearly";
export interface PlanChoice {
  plan: PlanKey;
  interval: BillingInterval;
}

const GROWTH_FEATURES = [
  "Your own link domain",
  "Event stream to webhooks and S3",
  "Retention controls for raw events",
  "Email support from our engineers",
];

export const FREE_MAU_LABEL = "10K";

export const FLAT_PLANS: {
  key: PlanKey;
  name: string;
  band: string;
  cap: string;
  monthly: number;
  yearly: number;
  description: string;
  inherits: string;
  features: string[];
}[] = [
  {
    key: "growth_250k",
    name: "Growth",
    band: "up to 250K MAU",
    cap: "250K",
    monthly: 249,
    yearly: 2500,
    description: "Custom domain, event stream, retention controls",
    inherits: "Free",
    features: GROWTH_FEATURES,
  },
  {
    key: "growth_500k",
    name: "Growth",
    band: "up to 500K MAU",
    cap: "500K",
    monthly: 499,
    yearly: 5000,
    description: "Same features, twice the headroom",
    inherits: "Free",
    features: GROWTH_FEATURES,
  },
  {
    key: "scale_1m",
    name: "Scale",
    band: "up to 1M MAU",
    cap: "1M",
    monthly: 1199,
    yearly: 12000,
    description: "Adds uptime SLA, priority support and onboarding",
    inherits: "Growth",
    features: [
      "99.9% monthly uptime SLA with service credits",
      "Priority support with SLA response times",
      "Onboarding sessions with our engineers",
    ],
  },
];

export interface StripeSubscription {
  current_period_start: number;
  current_period_end: number;
}

export interface LatestInvoice {
  number: string | null;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
  amount_paid: number | null;
  status: string | null;
  paid_at: number | null;
}

export interface BilledTo {
  name: string | null;
  tax_id: string | null;
  address_lines: string[] | null;
}

export interface Subscription {
  type: string;
  current_maus: number;
  total_maus: number;
  maus: number;
  stripe_subscription: StripeSubscription;
  quantity_for_current_billing_cycle: number;
  amount_cents: number | null;
  start_at: string;
  end_at: string;
  plan?: PlanKey;
  interval?: BillingInterval;
  mau_cap?: number;
  cancels_at?: string | null;
  next_payment_attempt?: number | null;
  details?: { active: boolean; paused: boolean } | null;
  payment_issue?: boolean;
  status?: string | null;
  latest_invoice?: LatestInvoice | null;
  billed_to?: BilledTo | null;
}

export interface MAU {
  current_quantity: number;
  total_available: number;
}
