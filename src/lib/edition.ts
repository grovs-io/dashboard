/** Build-time constant — NEXT_PUBLIC_ vars are inlined by Next.js at compile time. */
export const IS_ENTERPRISE = process.env.NEXT_PUBLIC_GROVS_EE === "true";

/**
 * Self-hosted build. Hides SaaS-only UI such as public sign-up and Stripe
 * billing. SSO visibility is discovered from the backend at runtime because
 * Google and Microsoft can be configured independently.
 */
export const IS_SELF_HOSTED = process.env.NEXT_PUBLIC_SELF_HOSTED === "true";
