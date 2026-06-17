/** Build-time constant — NEXT_PUBLIC_ vars are inlined by Next.js at compile time. */
export const IS_ENTERPRISE = process.env.NEXT_PUBLIC_GROVS_EE === "true";

/**
 * Self-hosted build. Hides SaaS-only UI (SSO, public sign-up, Stripe billing).
 * Defaults false, so SaaS/private builds are unchanged.
 */
export const IS_SELF_HOSTED = process.env.NEXT_PUBLIC_SELF_HOSTED === "true";
