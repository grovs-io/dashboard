interface ContentSecurityPolicyOptions {
  apiUrl: string;
  nodeEnv?: string;
  posthogUrl?: string;
  posthogEnabled?: boolean;
  gtmEnabled?: boolean;
  chatwootUrl?: string;
  chatwootEnabled?: boolean;
  stripeEnabled?: boolean;
}

// Stripe.js + Checkout Elements + Link, per docs.stripe.com/security/guide#content-security-policy.
const STRIPE_SCRIPT = [
  "https://js.stripe.com",
  "https://*.js.stripe.com",
  "https://checkout.stripe.com",
];
const STRIPE_FRAME = [
  "https://js.stripe.com",
  "https://*.js.stripe.com",
  "https://hooks.stripe.com",
  "https://checkout.stripe.com",
  "https://link.com",
  "https://*.link.com",
];
const STRIPE_CONNECT = [
  "https://api.stripe.com",
  "https://checkout.stripe.com",
  "https://merchant-ui-api.stripe.com",
  "https://errors.stripe.com",
  "https://link.com",
  "https://*.link.com",
  // Stripe.js fetches the Geist CSS passed in elementsOptions.fonts.
  "https://fonts.googleapis.com",
];

const origin = (value: string): string => new URL(value).origin;

export const buildContentSecurityPolicy = ({
  apiUrl,
  nodeEnv = "production",
  posthogUrl = "https://eu.i.posthog.com",
  posthogEnabled = false,
  gtmEnabled = false,
  chatwootUrl = "",
  chatwootEnabled = false,
  stripeEnabled = false,
}: ContentSecurityPolicyOptions): string => {
  const stripe = (sources: string[]) => (stripeEnabled ? sources : []);
  const apiOrigin = origin(apiUrl);
  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    nodeEnv === "development" ? "'unsafe-eval'" : "",
    gtmEnabled ? "https://www.googletagmanager.com" : "",
    posthogEnabled ? posthogUrl : "",
    chatwootEnabled ? chatwootUrl : "",
    ...stripe(STRIPE_SCRIPT),
  ].filter(Boolean);
  const connectSources = [
    "'self'",
    apiOrigin,
    posthogEnabled ? posthogUrl : "",
    gtmEnabled ? "https://*.google-analytics.com" : "",
    gtmEnabled ? "https://www.googletagmanager.com" : "",
    gtmEnabled ? "https://www.google.com" : "",
    gtmEnabled ? "https://*.googleadservices.com" : "",
    gtmEnabled ? "https://*.g.doubleclick.net" : "",
    "https://api.github.com",
    chatwootEnabled ? chatwootUrl : "",
    ...stripe(STRIPE_CONNECT),
  ].filter(Boolean);
  // Uploads are served by the API; a local one is plain http, which https: alone would block.
  const imageSources = [
    "'self'",
    "data:",
    "blob:",
    "https:",
    apiOrigin,
    nodeEnv === "development" ? "http:" : "",
  ].filter(Boolean);
  const frameSources = [
    "'self'",
    // The in-app HTML preview runs on the API's origin, under its own CSP.
    apiOrigin,
    gtmEnabled ? "https://www.googletagmanager.com" : "",
    chatwootEnabled ? chatwootUrl : "",
    ...stripe(STRIPE_FRAME),
  ].filter(Boolean);

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src ${imageSources.join(" ")}`,
    // In-app media tiles show uploaded videos and audio from the same places as images.
    `media-src ${imageSources.join(" ")}`,
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src ${connectSources.join(" ")}`,
    `frame-src ${frameSources.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
};
