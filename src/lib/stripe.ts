import type { Stripe } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js/pure";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

export const hasStripeKey = !!publishableKey;

let stripePromise: Promise<Stripe | null> | null = null;

// Resolves to null when Stripe.js is blocked or fails to load.
export const getStripe = (): Promise<Stripe | null> | null => {
  if (!publishableKey) return null;
  stripePromise ??= loadStripe(publishableKey).catch(() => null);
  return stripePromise;
};
