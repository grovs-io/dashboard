const apiUrl =
  (typeof window !== "undefined"
    ? window.__GROVS_RUNTIME_CONFIG__?.apiUrl
    : process.env.API_URL) ??
  process.env.NEXT_PUBLIC_API_URL ??
  "";

// OAuth client id is server-only and read at runtime — see src/lib/serverConfig.ts.
export const config = {
  apiUrl,
  apiPath: process.env.NEXT_PUBLIC_API_PATH ?? "/api/v1",
  docsUrl: process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.grovs.io",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@grovs.io",
  termsUrl: process.env.NEXT_PUBLIC_TERMS_URL ?? "https://grovs.io/terms",
  privacyUrl: process.env.NEXT_PUBLIC_PRIVACY_URL ?? "https://grovs.io/privacy",
  pricingUrl: process.env.NEXT_PUBLIC_PRICING_URL ?? "https://grovs.io/pricing",
  salesUrl: process.env.NEXT_PUBLIC_SALES_URL ?? "https://grovs.io/sales",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://app.grovs.io",
} as const;
