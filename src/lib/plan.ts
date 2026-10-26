import { IS_SELF_HOSTED } from "@/lib/edition";
import type { Subscription } from "@/types/payment";

/** Self-hosted is always paid; cloud needs a subscription without a payment issue. */
export const hasPaidPlan = (sub?: Subscription | null) =>
  IS_SELF_HOSTED || (!!sub && !sub.payment_issue);
